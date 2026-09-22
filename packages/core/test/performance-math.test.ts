import assert from "node:assert/strict";
import test from "node:test";
import {
  valuationSnapshotSchema,
  ledgerEventSchema,
  benchmarkResultSchema,
} from "@portfolio-atlas/contracts";
import { reconcileBook } from "../src/domain/accounting/reconcile-book.js";
import { calculatePerformance } from "../src/domain/performance/calculate-performance.js";
// Authored arithmetic inputs isolate the return equation; HTTP tests use actual journal valuations.
function v(id: string, nav: string, asOf: string, checkpoint = 0) {
  return valuationSnapshotSchema.parse({
    id,
    revision: 1,
    createdAt: asOf,
    policyVersion: "chapter-6.v1",
    request: { portfolioId: "p", checkpoint, asOf, prices: [] },
    baseCurrency: "USD",
    book: { ...reconcileBook("p", [], [], asOf), checkpoint },
    status: "complete",
    positions: [],
    cash: [],
    fxEvidence: [],
    totals: { cashBase: nav, holdingsBase: "0.00", nav },
    coverage: {
      valuedHoldings: 0,
      totalHoldings: 0,
      valuedCashCurrencies: 0,
      totalCashCurrencies: 0,
    },
    externalCapital: [],
    warnings: [],
  });
}
const t0 = "2026-01-01T23:59:59.999Z",
  t1 = "2026-01-02T23:59:59.999Z",
  t2 = "2026-01-03T23:59:59.999Z";
test("TWR compounds, Dietz weights mid-period flows, zero capital and benchmark mismatches stay explicit", () => {
  const geometric = calculatePerformance(
    [v("a", "100.00", t0), v("b", "110.00", t1), v("c", "99.00", t2)],
    [],
    null,
  );
  assert.ok(Math.abs(geometric.twr.value! + 0.01) < 1e-12);
  assert.equal(geometric.periods[0]!.netReturn, 0.1);
  assert.equal(geometric.periods[1]!.netReturn, -0.1);
  const deposit = ledgerEventSchema.parse({
    id: "flow",
    portfolioId: "p",
    sequence: 1,
    recordedAt: t1,
    instrumentSnapshot: null,
    input: {
      portfolioId: "p",
      kind: "deposit",
      currency: "USD",
      amount: "100.00",
      sourceRef: "midpoint-flow",
      occurredAt: t1,
    },
  });
  const dietz = calculatePerformance(
    [v("a", "100.00", t0), v("b", "220.00", t2, 1)],
    [deposit],
    null,
  );
  assert.equal(dietz.twr.value, null);
  assert.ok(Math.abs(dietz.modifiedDietz.value! - 20 / 150) < 1e-12);
  assert.equal(
    calculatePerformance([v("a", "0.00", t0), v("b", "0.00", t2)], [], null).twr.value,
    null,
  );
  const benchmark = benchmarkResultSchema.parse({
    id: "bm",
    createdAt: t2,
    definition: {
      id: "def",
      revision: 1,
      createdAt: t2,
      input: {
        name: "Authored benchmark",
        currency: "USD",
        returnBasis: "gross_total_return",
        adjustmentRuns: [{ id: "adjustment", revision: 1 }],
      },
      weighting: "equal_weight_at_start",
      rebalance: "start_only_buy_and_hold",
      incomeConvention: "gross_reinvested_no_tax",
      policyVersion: "chapter-6.v1",
    },
    status: "ready",
    reasons: [],
    warnings: [],
    constituents: [],
    series: [
      { date: "2026-01-01", level: 100, returnFromStart: 0 },
      { date: "2026-01-03", level: 110, returnFromStart: 0.1 },
    ],
    totalReturn: 0.1,
    packageVersion: "0.13.2",
    verification: "verified_shared_fixture_parity",
  });
  assert.equal(
    calculatePerformance([v("a", "100.00", t0), v("b", "110.00", t2)], [], benchmark).comparison
      .status,
    "compatible",
  );
  benchmark.definition.input.returnBasis = "price";
  assert.equal(
    calculatePerformance([v("a", "100.00", t0), v("b", "110.00", t2)], [], benchmark).comparison
      .status,
    "incompatible",
  );
});
