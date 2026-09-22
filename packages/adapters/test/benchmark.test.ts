import assert from "node:assert/strict";
import test from "node:test";
import {
  benchmarkDefinitionSchema,
  type BenchmarkDefinition,
  type MarketDataset,
  type AdjustmentResult,
} from "@portfolio-atlas/contracts";
import { compareBenchmark, type BenchmarkSource } from "@portfolio-atlas/core";
import { fixtureTime, syntheticInstruments } from "@portfolio-atlas/testing";
import { FintechBenchmarkEngine } from "../src/analytics/fintech-algorithms/benchmark-engine.js";
function source(id: string, prices: number[], dividend = 0): BenchmarkSource {
  const instrument = { ...syntheticInstruments[0]!, instrumentId: id, returnedSymbol: id };
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
  const dataset: MarketDataset = {
    id: "data-" + id,
    revision: 1,
    createdAt: fixtureTime,
    instrument,
    request: {
      instrumentId: id,
      instrumentRevision: 1,
      from: dates[0]!,
      to: "2026-09-04",
      scenario: "clean",
    },
    source: "synthetic",
    observedAt: fixtureTime,
    cache: "fresh",
    sourceHash: "a".repeat(64),
    archiveRef: "authored",
    interval: "1d",
    timezone: instrument.timezone,
    quoteUnit: instrument.quoteUnit,
    basis: "synthetic_unadjusted",
    availability: "observed_now_not_historical",
    rows: [],
    quality: {
      policyVersion: "chapter-3.v1",
      acceptedIndexes: [],
      quarantinedIndexes: [],
      rows: [],
      coverage: {
        expectedSessions: 3,
        observedSessions: 3,
        missingSessions: [],
        evidence: "authored",
      },
      warnings: [],
    },
  };
  const run: AdjustmentResult = {
    id: "run-" + id,
    revision: 1,
    createdAt: fixtureTime,
    status: "ready",
    datasetId: dataset.id,
    datasetRevision: 1,
    sourceHash: dataset.sourceHash,
    reviewId: "review-" + id,
    actionKnowledgeAt: fixtureTime,
    priceObservedAt: fixtureTime,
    method: "chapter-4.v1_current-price-research",
    sourceCurrency: "USD",
    targetCurrency: "USD",
    series: prices.map((price, i) => ({
      date: dates[i]!,
      sourceRowId: "row-" + i,
      providerClose: price,
      splitAdjustedClose: price,
      totalReturnClose: price,
      splitAdjustedVolume: 100,
      convertedClose: price,
      splitFactor: 1,
      dividendFactor: 1,
    })),
    selectedActions: dividend
      ? [
          {
            id: "dividend",
            revision: 1,
            instrumentId: id,
            kind: "cash_dividend",
            status: "confirmed",
            effectiveDate: dates[1]!,
            availableAt: dates[0] + "T00:00:00Z",
            observedAt: fixtureTime,
            source: "synthetic",
            sourceRef: "authored",
            ratio: null,
            amount: dividend,
            currency: "USD",
            reasons: [],
          },
        ]
      : [],
    excludedActions: [],
    fx: null,
    reasons: [],
    warnings: [],
    dividendTreatment: "embedded_in_total_return_do_not_add_cash_again",
  };
  return { dataset, run };
}
function definition(
  sources: BenchmarkSource[],
  basis: "price" | "gross_total_return" = "price",
): BenchmarkDefinition {
  return benchmarkDefinitionSchema.parse({
    id: "definition",
    revision: 1,
    createdAt: fixtureTime,
    input: {
      name: "Authored benchmark",
      currency: "USD",
      returnBasis: basis,
      adjustmentRuns: sources.map((s) => ({ id: s.run.id, revision: 1 })),
    },
    weighting: "equal_weight_at_start",
    rebalance: "start_only_buy_and_hold",
    incomeConvention: basis === "price" ? "excluded" : "gross_reinvested_no_tax",
    policyVersion: "chapter-6.v1",
  });
}
test("equal-weight buy-and-hold drifts and differs from a daily reset", () => {
  const sources = [source("A", [100, 120, 120]), source("B", [100, 80, 100])];
  const d = definition(sources),
    engine = new FintechBenchmarkEngine(),
    result = engine.calculate(d, sources);
  assert.equal(result.status, "ready", result.reasons.join(";"));
  assert.deepEqual(
    result.series.map((r) => r.level),
    [1000, 1000, 1100],
  );
  assert.ok(Math.abs(result.totalReturn! - 0.1) < 1e-12);
  assert.notEqual(result.totalReturn, 0.125); // A daily reset would earn 12.5%.
  assert.deepEqual(
    result.constituents.map((c) => c.initialWeight),
    [0.5, 0.5],
  );
  const reverse = [...sources].reverse(),
    permuted = engine.calculate(definition(reverse), reverse);
  assert.deepEqual(permuted.series, result.series);
});
test("gross reinvestment adds ex-date income once and exposes a price-only mismatch", () => {
  const sources = [source("A", [100, 90, 99], 10)],
    engine = new FintechBenchmarkEngine();
  const price = engine.calculate(definition(sources), sources);
  assert.ok(Math.abs(price.totalReturn! + 0.01) < 1e-12);
  const d = definition(sources, "gross_total_return"),
    gross = engine.calculate(d, sources);
  assert.deepEqual(
    gross.series.map((r) => r.level),
    [1000, 1000, 1100],
  );
  const result = { id: "result", createdAt: fixtureTime, definition: d, ...gross };
  assert.equal(compareBenchmark(result, "price", "USD").status, "incompatible");
  assert.equal(compareBenchmark(result, "gross_total_return", "EUR").status, "incompatible");
  assert.equal(compareBenchmark(result, "gross_total_return", "USD").status, "compatible");
});
test("misaligned dates, duplicate listings and unknown currencies cannot become a benchmark", () => {
  const a = source("A", [100, 120, 120]),
    b = source("B", [100, 80, 100]),
    engine = new FintechBenchmarkEngine();
  b.run.series[1]!.date = "2026-09-04";
  assert.equal(engine.calculate(definition([a, b]), [a, b]).status, "unsupported");
  const duplicate = { ...a, run: { ...a.run, id: "another-run-for-A" } };
  assert.equal(engine.calculate(definition([a, duplicate]), [a, duplicate]).status, "unsupported");
  a.run.sourceCurrency = null;
  assert.equal(engine.calculate(definition([a]), [a]).status, "unsupported");
});
