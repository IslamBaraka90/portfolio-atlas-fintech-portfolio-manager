import assert from "node:assert/strict";
import test from "node:test";
import {
  targetSnapshotSchema,
  valuationSnapshotSchema,
  rebalanceRequestSchema,
  postingInputSchema,
  type LedgerEvent,
  type JournalEntry,
} from "@portfolio-atlas/contracts";
import { syntheticInstruments, demoMandate, fixtureTime } from "@portfolio-atlas/testing";
import { postingEntry } from "../src/domain/accounting/project-book.js";
import { reconcileBook } from "../src/domain/accounting/reconcile-book.js";
import { valueBook } from "../src/domain/valuation/value-book.js";
import { planRebalance, fifoSale } from "../src/domain/rebalancing/plan-rebalance.js";
function setup(shares = 0, capital = 10000, harbor = 0, reserve = 0) {
  const instruments = [syntheticInstruments[0]!, syntheticInstruments[2]!],
    events: LedgerEvent[] = [],
    journal: JournalEntry[] = [];
  function post(value: object) {
    const input = postingInputSchema.parse({
      portfolioId: "p",
      sourceRef: "setup-" + events.length,
      occurredAt: fixtureTime,
      ...value,
    });
    const e: LedgerEvent = {
      id: "setup-" + events.length,
      portfolioId: "p",
      sequence: events.length + 1,
      recordedAt: fixtureTime,
      input,
      instrumentSnapshot:
        "instrumentId" in input
          ? instruments.find((i) => i.instrumentId === input.instrumentId)!
          : null,
    };
    journal.push(postingEntry(events, e));
    events.push(e);
  }
  post({ kind: "deposit", currency: "USD", amount: String(capital) });
  if (shares)
    post({
      kind: "buy",
      currency: "USD",
      instrumentId: instruments[0]!.instrumentId,
      instrumentRevision: 1,
      quantity: String(shares),
      unitPrice: "100",
    });
  if (harbor)
    post({
      kind: "buy",
      currency: "USD",
      instrumentId: instruments[1]!.instrumentId,
      instrumentRevision: 1,
      quantity: String(harbor),
      unitPrice: "100",
    });
  if (reserve)
    post({
      kind: "reserve",
      currency: "USD",
      amount: String(reserve),
      reservationId: "other-order",
    });
  const source = { events, journal, book: reconcileBook("p", events, journal, fixtureTime) };
  const request = {
    portfolioId: "p",
    checkpoint: events.length,
    asOf: fixtureTime,
    maxPriceAgeSeconds: 3600,
    prices: [],
    overrides: [],
    fxRuns: [],
  };
  const marks = source.book.positions.map((p) => ({
    instrumentId: p.instrumentId,
    currency: "USD" as const,
    price: "100",
    status: "accepted" as const,
    quotedAt: fixtureTime,
    observedAt: fixtureTime,
    dataset: null,
    rowId: null,
    sourceHash: null,
    reviewId: null,
    override: null,
    reasons: [],
  }));
  const valuation = valuationSnapshotSchema.parse({
    id: "v",
    revision: 1,
    createdAt: fixtureTime,
    policyVersion: "chapter-6.v1",
    request,
    ...valueBook(source, request, "USD", marks, []),
  });
  const target = targetSnapshotSchema.parse({
    id: "t",
    revision: 1,
    createdAt: fixtureTime,
    request: {
      portfolioId: "p",
      mandateRevision: 1,
      riskModel: { id: "r", revision: 1 },
      valuation: { id: "v", revision: 1 },
      method: "equal_weight",
    },
    mandate: {
      ...demoMandate,
      id: "m",
      revision: 1,
      createdAt: fixtureTime,
      updatedAt: fixtureTime,
    },
    instruments,
    currency: "USD",
    bookCheckpoint: 1,
    status: "proposal",
    reasons: [],
    warnings: [],
    assetIds: instruments.map((i) => i.instrumentId),
    currentWeights: [0, 0, 1],
    weights: [0.4, 0.4],
    cashWeight: 0.2,
    expectedReturn: null,
    variance: null,
    volatility: null,
    varianceContributions: null,
    riskShares: null,
    turnover: null,
    riskyTradeNotional: null,
    estimatedCostFraction: null,
    constraints: [],
    solver: null,
    packageVersion: "0.13.2",
    verification: "contract_tier_with_application_examples",
    policyVersion: "chapter-9.v1",
    createsOrders: false,
    executable: false,
  });
  const rebalance = rebalanceRequestSchema.parse({
    target: { id: "t", revision: 1 },
    valuation: { id: "v", revision: 1 },
    newPrices: instruments
      .filter((i) => !source.book.positions.some((p) => p.instrumentId === i.instrumentId))
      .map((i) => ({
        instrumentId: i.instrumentId,
        currency: "USD",
        price: "100",
        quotedAt: fixtureTime,
        sourceRef: "authored-price",
        reason: "Authored current teaching mark",
      })),
  });
  return { target, valuation, source, rebalance };
}
test("whole-share proposal funds fees and checks post-cost mandate limits", () => {
  const f = setup();
  const result = planRebalance(f.rebalance, f.target, f.valuation, f.source, fixtureTime);
  assert.equal(result.status, "ready");
  assert.deepEqual(
    result.trades.map((t) => t.quantity),
    ["39.00000000", "39.00000000"],
  );
  assert.deepEqual(result.cashBridge, {
    opening: "10000.00",
    sales: "0.00",
    purchases: "7800.00",
    fees: "7.80",
    closing: "2192.20",
    reserved: "0.00",
    available: "2192.20",
  });
  assert.equal(result.projectedNav, "9992.20");
  assert.ok(result.constraints.every((c) => c.status === "pass"));
  assert.equal(f.source.events.length, 1);
  const rejected = planRebalance(
    { ...f.rebalance, feeBps: 500 },
    f.target,
    f.valuation,
    f.source,
    fixtureTime,
  );
  assert.equal(rejected.status, "rejected");
  assert.ok(rejected.reasons.some((r) => r.startsWith("COST_LIMIT")));
  const minimal = planRebalance(
    { ...f.rebalance, minTrade: "5000" },
    f.target,
    f.valuation,
    f.source,
    fixtureTime,
  );
  assert.equal(minimal.status, "no_trade");
  assert.equal(minimal.trades.length, 0);
  const future = planRebalance(
    { ...f.rebalance, trigger: "calendar", dueAt: "2026-09-23T00:00:00Z" },
    f.target,
    f.valuation,
    f.source,
    fixtureTime,
  );
  assert.equal(future.triggered, false);
});
test("contributions reduce sales and cash-flow-first preserves existing positions", () => {
  const a = setup(60),
    b = setup(60, 15000);
  const first = planRebalance(
    { ...a.rebalance, feeBps: 0 },
    a.target,
    a.valuation,
    a.source,
    fixtureTime,
  );
  const contributed = planRebalance(
    { ...b.rebalance, feeBps: 0 },
    b.target,
    b.valuation,
    b.source,
    fixtureTime,
  );
  assert.equal(first.trades.find((t) => t.side === "sell")!.quantity, "20.00000000");
  assert.equal(contributed.trades.filter((t) => t.side === "sell").length, 0);
  const cashOnly = planRebalance(
    { ...a.rebalance, trigger: "cash_flow", feeBps: 0 },
    a.target,
    a.valuation,
    a.source,
    fixtureTime,
  );
  assert.equal(cashOnly.trades.filter((t) => t.side === "sell").length, 0);
  assert.equal(cashOnly.status, "rejected");
  const balanced = setup(40);
  // Add Harbor at the same price to produce exact 40/40/20.
  const base = planRebalance(
    { ...balanced.rebalance, feeBps: 0 },
    balanced.target,
    balanced.valuation,
    balanced.source,
    fixtureTime,
  );
  assert.equal(base.trades.length, 1);
  assert.equal(base.trades[0]!.instrumentId, "DEMO-HARBOR");
});
test("FIFO lot selection conserves final cents and same-time insertion order", () => {
  const lots = [
    {
      lotId: "z-first",
      acquisitionEventId: "z",
      instrumentId: "a",
      currency: "USD" as const,
      acquiredAt: fixtureTime,
      quantityRemaining: "3",
      costRemaining: "100",
      unitCost: "33.33333333",
    },
    {
      lotId: "a-second",
      acquisitionEventId: "a",
      instrumentId: "a",
      currency: "USD" as const,
      acquiredAt: fixtureTime,
      quantityRemaining: "2",
      costRemaining: "90",
      unitCost: "45",
    },
  ];
  const rows = fifoSale(lots, "a", "4", "50");
  assert.deepEqual(
    rows.map((r) => [r.lotId, r.quantity, r.basisRemoved]),
    [
      ["z-first", "3.00000000", "100.00"],
      ["a-second", "1.00000000", "45.00"],
    ],
  );
  assert.throws(() => fifoSale(lots, "a", "6", "50"), /exceeds remaining/);
});

test("an already balanced book creates no trades or fees even with a positive fee assumption", () => {
  const f = setup(40, 10000, 40);
  const result = planRebalance(f.rebalance, f.target, f.valuation, f.source, fixtureTime);
  assert.equal(result.status, "no_trade");
  assert.equal(result.trades.length, 0);
  assert.equal(result.cashBridge.fees, "0.00");
  assert.equal(result.projectedNav, "10000.00");
  assert.ok(result.constraints.every((c) => c.status === "pass"));
});

test("reserved funds cannot finance a rebalance and off-tick or stale marks fail", () => {
  const f = setup(0, 10000, 0, 9500);
  const result = planRebalance(f.rebalance, f.target, f.valuation, f.source, fixtureTime);
  assert.equal(result.trades.length, 0);
  assert.equal(result.cashBridge.available, "500.00");
  assert.ok(result.constraints.some((c) => c.rule === "CASH_MINIMUM" && c.status === "fail"));
  const g = setup();
  assert.throws(
    () =>
      planRebalance(
        {
          ...g.rebalance,
          newPrices: g.rebalance.newPrices.map((p) => ({ ...p, price: "100.001" })),
        },
        g.target,
        g.valuation,
        g.source,
        fixtureTime,
      ),
    /tick/,
  );
  assert.throws(
    () =>
      planRebalance(
        {
          ...g.rebalance,
          newPrices: g.rebalance.newPrices.map((p) => ({ ...p, quotedAt: "2026-09-01T00:00:00Z" })),
        },
        g.target,
        g.valuation,
        g.source,
        fixtureTime,
      ),
    /one hour/,
  );
});
