import assert from "node:assert/strict";
import test from "node:test";
import {
  marketDatasetSchema,
  companyObservationSchema,
  researchRequestSchema,
} from "@portfolio-atlas/contracts";
import { fixtureTime, syntheticInstruments } from "@portfolio-atlas/testing";
import { SyntheticChartProvider } from "../src/market-data/synthetic-chart-provider.js";
import { SyntheticCompanyProvider } from "../src/market-data/synthetic-company-provider.js";
import { FintechMarketQualityValidator } from "../src/analytics/fintech-algorithms/market-quality.js";
import {
  FintechResearchEngine,
  alignedSma,
} from "../src/analytics/fintech-algorithms/research-engine.js";
const clock = { now: () => fixtureTime },
  instrument = syntheticInstruments[0]!;
async function fixture() {
  const request = {
    instrumentId: instrument.instrumentId,
    instrumentRevision: 1,
    from: "2026-09-01",
    to: "2026-09-18",
    scenario: "clean" as const,
  };
  const chart = await new SyntheticChartProvider(clock).chart(instrument, request);
  assert.equal(chart.status, "available");
  if (chart.status !== "available") throw new Error();
  const dataset = marketDatasetSchema.parse({
    id: "data",
    revision: 1,
    createdAt: fixtureTime,
    instrument,
    request,
    source: "synthetic",
    observedAt: fixtureTime,
    cache: "fresh",
    sourceHash: "a".repeat(64),
    archiveRef: "authored",
    interval: "1d",
    rows: chart.data.rows,
    timezone: chart.data.timezone,
    quoteUnit: chart.data.quoteUnit,
    basis: chart.data.basis,
    availability: "observed_now_not_historical",
    quality: new FintechMarketQualityValidator().validate(
      chart.data,
      instrument,
      request,
      fixtureTime,
    ),
  });
  return dataset;
}
async function company(
  scenario: "standard" | "missing" | "zero-revenue" | "late-revision" = "standard",
) {
  const request = {
    instrumentId: instrument.instrumentId,
    instrumentRevision: 1,
    from: "2024-01-01",
    to: "2026-01-01",
    frequency: "annual" as const,
    scenario,
  };
  const facts = await new SyntheticCompanyProvider(clock).fetch(instrument, request);
  if (facts.status !== "available") throw new Error();
  return companyObservationSchema.parse({
    id: "company",
    revision: 1,
    createdAt: fixtureTime,
    observedAt: fixtureTime,
    instrument,
    request,
    source: "synthetic",
    sourceHash: "b".repeat(64),
    archiveRef: "authored",
    periods: facts.data.periods,
    warnings: facts.data.warnings,
  });
}
const engine = new FintechResearchEngine();
const request = researchRequestSchema.parse({
  series: [{ dataset: { id: "data", revision: 1 } }],
  asOf: fixtureTime,
});
test("SMA preserves slots and independently restarts warm-up after a missing observation", () => {
  assert.deepEqual(alignedSma([1, 2, 3, null, 7, 8, 9], 3), [null, null, 2, null, null, null, 8]);
});
test("independent trend, common-size and selected-universe breadth examples", async () => {
  const dataset = await fixture();
  const output = engine.calculate(request, [{ dataset, run: null }], [await company()]);
  assert.equal(output.trends[0]!.status, "ready");
  assert.deepEqual(
    output.trends[0]!.rows.slice(0, 3).map((r) => r.sma),
    [null, null, 102],
  );
  assert.equal(output.trends[0]!.rows[0]!.timestamp, dataset.rows[0]!.timestamp);
  assert.equal(output.trends[0]!.latestRelation, "above");
  assert.equal(output.fundamentals[0]!.focusPercentage, 15);
  assert.equal(output.fundamentals[0]!.focusChangePercentagePoints, 5);
  assert.equal(output.breadth.netAdvances, 1);
  assert.equal(output.breadth.coverageRatio, 1);
  assert.equal(output.createsOrders, false);
});
test("late revisions obey availability; unknown, mixed, missing and zero denominators stay unavailable", async () => {
  const dataset = await fixture(),
    late = await company("late-revision");
  const before = engine.calculate(
    { ...request, asOf: "2026-09-19T12:00:00Z" },
    [{ dataset, run: null }],
    [late],
  );
  assert.equal(before.fundamentals[0]!.focusPercentage, 15);
  assert.equal(before.trends[0]!.status, "unavailable");
  assert.equal(
    engine.calculate(request, [{ dataset, run: null }], [late]).fundamentals[0]!.focusPercentage,
    12.5,
  );
  for (const bad of [await company("missing"), await company("zero-revenue")]) {
    assert.equal(
      engine.calculate(request, [{ dataset, run: null }], [bad]).fundamentals[0]!.status,
      "unavailable",
    );
  }
  const mixed = await company();
  mixed.periods[1]!.currency = "EUR";
  assert.match(
    engine.calculate(request, [{ dataset, run: null }], [mixed]).fundamentals[0]!.reasons.join(),
    /currencies/,
  );
  mixed.periods[1]!.currency = "USD";
  mixed.periods[1]!.periodType = "3M";
  assert.equal(
    engine.calculate(request, [{ dataset, run: null }], [mixed]).fundamentals[0]!.status,
    "unavailable",
  );
});
test("current observations cannot be backdated into strategy evidence, and missing members retain coverage", async () => {
  const dataset = await fixture(),
    live = await company();
  live.source = "yahoo";
  live.periods.forEach((p) => {
    p.availabilityBasis = "observed_now";
    p.availableAt = fixtureTime;
  });
  const output = engine.calculate(
    { ...request, purpose: "historical_strategy" },
    [{ dataset, run: null }],
    [live],
  );
  assert.equal(output.fundamentals[0]!.historicalAvailabilityProven, false);
  assert.equal(output.fundamentals[0]!.status, "unavailable");
  assert.equal(output.trends[0]!.status, "unavailable");
  const second = structuredClone(dataset);
  second.instrument.instrumentId = "second";
  second.quality.acceptedIndexes.pop();
  const mixed = engine.calculate(
    request,
    [
      { dataset, run: null },
      { dataset: second, run: null },
    ],
    [],
  );
  assert.equal(mixed.breadth.status, "incomplete");
  assert.equal(mixed.breadth.coverageRatio, 0.5);
  assert.equal(mixed.breadth.netAdvances, null);
  second.quality.coverage.missingSessions.push({
    sessionDate: "2026-09-10",
    classification: "unknown",
    reason: "Missing",
  });
  assert.match(
    engine.calculate(request, [{ dataset: second, run: null }], []).trends[0]!.reasons.join(),
    /compress/,
  );
});
