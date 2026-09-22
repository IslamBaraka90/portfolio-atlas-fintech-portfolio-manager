import assert from "node:assert/strict";
import test from "node:test";
import { statementSnapshotSchema, type ReconciliationRun } from "@portfolio-atlas/contracts";
import { reconcileStatement } from "../src/domain/reconciliation/reconcile-statement.js";
import { reconcileBook } from "../src/domain/accounting/reconcile-book.js";
const at = "2026-09-22T10:00:00.000Z";
const book = { events: [], journal: [], book: reconcileBook("p", [], [], at) };
const trade: ReconciliationRun["expectedTrades"][number] = {
  lineId: "f1",
  fillId: "f1",
  instrumentId: "a",
  side: "buy",
  currency: "USD",
  quantity: "10",
  netCash: "101.00",
  fee: "1.00",
  tradeDate: "2026-09-21",
  valueDate: "2026-09-22",
};
function statement(trades: unknown[], positions: unknown[] = [], actions: unknown[] = []) {
  return statementSnapshotSchema.parse({
    id: "s",
    revision: 1,
    portfolioId: "p",
    sourceRef: "independent-custody",
    source: "synthetic_custodian_statement",
    asOf: at,
    importedAt: at,
    trades,
    positions,
    cash: [],
    actions,
  });
}
test("one ambiguous line cannot clear two fills and duplicate explicit references cannot clear one", () => {
  const two = [trade, { ...trade, lineId: "f2", fillId: "f2" }];
  const ambiguous = reconcileStatement(statement([{ ...trade, fillId: null }]), book, two);
  assert.equal(ambiguous.status, "breaks");
  assert.deepEqual(ambiguous.matchedFillIds, []);
  assert.deepEqual(ambiguous.breaks[0]!.candidateIds, ["f1", "f2"]);
  const reuse = reconcileStatement(statement([trade, { ...trade, lineId: "duplicate" }]), book, [
    trade,
  ]);
  assert.equal(reuse.breaks.filter((b) => b.category === "ambiguous").length, 2);
  assert.deepEqual(reuse.matchedFillIds, []);
  assert.deepEqual(reconcileStatement(statement([trade]), book, [trade]).matchedFillIds, ["f1"]);
});
test("exact comparison preserves one-share, cash, fee, action, missing and value-date differences", () => {
  const result = reconcileStatement(
    statement(
      [{ ...trade, quantity: "9", fee: "2.00", netCash: "92.00", valueDate: "2026-09-23" }],
      [{ instrumentId: "a", currency: "USD", settledQuantity: "1" }],
      [{ actionRef: "dividend-1", instrumentId: "a", currency: "USD", amount: "2.00" }],
    ),
    book,
    [trade],
  );
  assert.deepEqual(result.matchedFillIds, []);
  for (const category of ["quantity", "cash", "fee", "date", "action"])
    assert.ok(result.breaks.some((b) => b.category === category));
  assert.equal(result.breaks.find((b) => b.subject === "f1:quantity")!.observed, "9");
  assert.equal(reconcileStatement(statement([]), book, [trade]).breaks[0]!.category, "missing");
});
