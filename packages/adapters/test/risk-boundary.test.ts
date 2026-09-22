import assert from "node:assert/strict";
import test from "node:test";
import {
  marketDatasetSchema,
  adjustmentResultSchema,
  riskModelRequestSchema,
} from "@portfolio-atlas/contracts";
import type { BenchmarkSource } from "@portfolio-atlas/core";
import { syntheticInstruments, fixtureTime } from "@portfolio-atlas/testing";
import { FintechRiskEngine } from "../src/analytics/fintech-algorithms/risk-engine.js";
function source(id: string, prices: number[]): BenchmarkSource {
  const instrument = { ...syntheticInstruments[0]!, instrumentId: id, listingId: id };
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];
  const rows = prices.map((close, i) => ({
    rowId: id + "-" + i,
    sourceIndex: i,
    symbol: instrument.returnedSymbol,
    timestamp: dates[i] + "T13:30:00.000Z",
    sessionDate: dates[i],
    open: close,
    high: close,
    low: close,
    close,
    volume: 100,
    adjustedClose: null,
    finality: "final",
    evidence: "Independent authored covariance fixture",
  }));
  const dataset = marketDatasetSchema.parse({
    id: "data-" + id,
    revision: 1,
    createdAt: fixtureTime,
    instrument,
    request: {
      instrumentId: id,
      instrumentRevision: 1,
      from: "2026-09-01",
      to: "2026-09-05",
      scenario: "clean",
    },
    source: "synthetic",
    observedAt: fixtureTime,
    cache: "fresh",
    sourceHash: "a".repeat(64),
    archiveRef: "independent-authored-fixture",
    interval: "1d",
    timezone: instrument.timezone,
    quoteUnit: instrument.quoteUnit,
    basis: "synthetic_unadjusted",
    availability: "observed_now_not_historical",
    rows,
    quality: {
      policyVersion: "chapter-3.v1",
      acceptedIndexes: rows.map((_, i) => i),
      quarantinedIndexes: [],
      rows: rows.map((r, i) => ({ index: i, rowId: r.rowId, accepted: true, findings: [] })),
      coverage: {
        expectedSessions: rows.length,
        observedSessions: rows.length,
        missingSessions: [],
        evidence: "Authored four-session fixture",
      },
      warnings: [],
    },
  });
  const run = adjustmentResultSchema.parse({
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
    dividendTreatment: "embedded_in_total_return_do_not_add_cash_again",
    series: prices.map((p, i) => ({
      date: dates[i],
      sourceRowId: rows[i]!.rowId,
      providerClose: p,
      splitAdjustedClose: p,
      totalReturnClose: p,
      convertedClose: p,
      splitAdjustedVolume: 100,
      splitFactor: 1,
      dividendFactor: 1,
    })),
    selectedActions: [],
    excludedActions: [],
    fx: null,
    reasons: [],
    warnings: [],
  });
  return { dataset, run };
}
const engine = new FintechRiskEngine(),
  a = source("a", [100, 110, 99, 99]),
  b = source("b", [100, 100, 110, 99]);
const request = riskModelRequestSchema.parse({
  adjustmentRuns: [
    { id: a.run.id, revision: 1 },
    { id: b.run.id, revision: 1 },
  ],
  asOf: fixtureTime,
});
test("independent price-to-matrix example retains sample dates, order, units and no hidden mutation", () => {
  const inputs = structuredClone([a, b]),
    before = structuredClone(inputs);
  const result = engine.calculate(request, inputs);
  assert.equal(result.status, "ready");
  assert.equal(result.observations, 3);
  assert.equal(result.diagnostics!.rank, 2);
  assert.ok(Math.abs(result.covarianceDaily[0]![1]! + 0.005) < 1e-12);
  assert.ok(Math.abs(result.correlation[0]![1]! + 0.5) < 1e-12);
  assert.ok(Math.abs(result.volatilityAnnual[0]! - Math.sqrt(2.52)) < 1e-12);
  assert.deepEqual(result.annualExpectedReturns, [0, 0]);
  assert.deepEqual(inputs, before);
});
test("constant-price correlation remains undefined and PSD zero is not marked invertible", () => {
  const result = engine.calculate(request, [
    source("a", [100, 100, 100, 100]),
    source("b", [50, 50, 50, 50]),
  ]);
  assert.equal(result.status, "ready");
  assert.equal(result.diagnostics!.rank, 0);
  assert.equal(result.diagnostics!.positiveDefinite, false);
  assert.deepEqual(result.correlation, [
    [null, null],
    [null, null],
  ]);
  assert.deepEqual(result.volatilityAnnual, [0, 0]);
});
test("missing sessions, wrong order, future observations and currency mixing fail without pairwise deletion", () => {
  const variants: ((s: BenchmarkSource) => void)[] = [
    (s) => {
      s.run.series[1]!.date = "2026-09-05";
    },
    (s) => {
      s.dataset.quality.quarantinedIndexes = [1];
    },
    (s) => {
      s.dataset.observedAt = "2026-09-23T00:00:00Z";
    },
    (s) => {
      s.run.sourceCurrency = "EUR";
    },
    (s) => {
      s.run.datasetRevision = 2;
    },
    (s) => {
      s.dataset.quality.coverage.missingSessions = [
        { sessionDate: "2026-09-02", classification: "unknown", reason: "Missing" },
      ];
    },
  ];
  for (const change of variants) {
    const altered = structuredClone(b);
    change(altered);
    const result = engine.calculate(request, [a, altered]);
    assert.equal(result.status, "unavailable");
    assert.deepEqual(result.covarianceDaily, []);
    assert.ok(result.reasons.length);
  }
});
