import assert from "node:assert/strict";
import test from "node:test";
import {
  postingInputSchema,
  type LedgerEvent,
  type JournalEntry,
} from "@portfolio-atlas/contracts";
import { syntheticInstruments, fixtureTime } from "@portfolio-atlas/testing";
import { postingEntry, reversalEntry } from "../src/domain/accounting/project-book.js";
import { reconcileBook } from "../src/domain/accounting/reconcile-book.js";
import { normalizePosting } from "../src/domain/accounting/decimal.js";
function book() {
  const events: LedgerEvent[] = [],
    journal: JournalEntry[] = [];
  function post(input: Record<string, unknown>) {
    const parsed = normalizePosting(
      postingInputSchema.parse({
        portfolioId: "p",
        sourceRef: "source-" + (events.length + 1),
        occurredAt: fixtureTime,
        ...input,
      }),
    );
    const event: LedgerEvent = {
      id: "event-" + (events.length + 1),
      portfolioId: "p",
      sequence: events.length + 1,
      recordedAt: fixtureTime,
      instrumentSnapshot: "instrumentId" in parsed ? syntheticInstruments[0]! : null,
      input: parsed,
    };
    const entry = postingEntry(events, event);
    events.push(event);
    journal.push(entry);
    return event;
  }
  return {
    events,
    journal,
    post,
    snapshot: () => reconcileBook("p", events, journal, fixtureTime),
  };
}
const asset = { instrumentId: "DEMO-AURORA", instrumentRevision: 1, currency: "USD" };
test("independent deposit, buy, split and FIFO sale preserve cash, costs and double entry", () => {
  const b = book();
  b.post({ kind: "deposit", currency: "USD", amount: "10000" });
  b.post({ kind: "buy", ...asset, quantity: "10", unitPrice: "100", fee: "5" });
  let state = b.snapshot();
  assert.equal(state.cash[0]!.settled, "8995.00");
  assert.equal(state.positions[0]!.quantity, "10.00000000");
  assert.equal(state.positions[0]!.costBasis, "1000.00");
  assert.equal(state.reconciled, true);
  b.post({
    kind: "split",
    instrumentId: asset.instrumentId,
    instrumentRevision: 1,
    ratio: "2",
    evidenceRef: "authored split",
  });
  state = b.snapshot();
  assert.equal(state.positions[0]!.quantity, "20.00000000");
  assert.equal(state.positions[0]!.unitCost, "50.00000000");
  assert.equal(state.cash[0]!.settled, "8995.00");
  b.post({ kind: "sell", ...asset, quantity: "4", unitPrice: "55", fee: "1" });
  state = b.snapshot();
  assert.equal(state.cash[0]!.settled, "9214.00");
  assert.equal(state.positions[0]!.costBasis, "800.00");
  assert.equal(state.positions[0]!.quantity, "16.00000000");
  assert.equal(state.accounts.find((row) => row.account === "realized_pnl")?.balance, "-20.00");
  assert.equal(state.reconciled, true);
});
test("reservations protect available cash and a whole fill consumes only its named reservation", () => {
  const b = book();
  b.post({ kind: "deposit", currency: "USD", amount: "100" });
  b.post({ kind: "reserve", currency: "USD", amount: "80", reservationId: "order-1" });
  assert.equal(b.snapshot().cash[0]!.available, "20.00");
  assert.equal(b.snapshot().cash[0]!.settled, "100.00");
  assert.throws(
    () => b.post({ kind: "withdrawal", currency: "USD", amount: "21" }),
    /available cash/,
  );
  b.post({
    kind: "buy",
    ...asset,
    quantity: "1",
    unitPrice: "75",
    fee: "1",
    reservationId: "order-1",
  });
  assert.equal(b.snapshot().cash[0]!.available, "24.00");
  assert.equal(b.snapshot().reservations.length, 0);
  assert.throws(() => b.post({ kind: "release", reservationId: "order-1" }), /already consumed/);
  assert.throws(
    () => b.post({ kind: "sell", ...asset, quantity: "2", unitPrice: "75" }),
    /Insufficient shares/,
  );
});
test("decimal half-even money and final-lot disposal conserve every cent", () => {
  const b = book();
  b.post({ kind: "deposit", currency: "USD", amount: "1" });
  b.post({ kind: "buy", ...asset, quantity: "3", unitPrice: "0.335" });
  assert.equal(b.snapshot().positions[0]!.costBasis, "1.00");
  for (let i = 0; i < 3; i++) b.post({ kind: "sell", ...asset, quantity: "1", unitPrice: "0.40" });
  const state = b.snapshot();
  assert.equal(state.cash[0]!.settled, "1.20");
  assert.equal(state.lots[0]!.costRemaining, "0.00");
  assert.equal(state.positions.length, 0);
  assert.equal(state.reconciled, true);
});
test("reversal plus replacement leaves the original journal and independently rebuilds the corrected book", () => {
  const b = book();
  b.post({ kind: "deposit", currency: "USD", amount: "10000" });
  const original = b.post({ kind: "buy", ...asset, quantity: "10", unitPrice: "100", fee: "5" });
  const event: LedgerEvent = {
    id: "correction-3",
    portfolioId: "p",
    sequence: 3,
    recordedAt: fixtureTime,
    instrumentSnapshot: original.instrumentSnapshot,
    input: {
      kind: "reversal",
      portfolioId: "p",
      sourceRef: "correction-3",
      occurredAt: fixtureTime,
      note: "",
      originalEventId: original.id,
      reason: "Correct erroneous quantity",
    },
  };
  b.events.push(event);
  b.journal.push(reversalEntry(b.journal[1]!, event));
  b.post({ kind: "buy", ...asset, quantity: "8", unitPrice: "100", fee: "5" });
  const state = b.snapshot();
  assert.equal(state.cash[0]!.settled, "9195.00");
  assert.equal(state.positions[0]!.quantity, "8.00000000");
  assert.equal(b.journal.length, 4);
  assert.equal(state.reconciled, true);
  const corrupt = structuredClone(b.journal);
  corrupt[3]!.lines[0]!.amount = "801.00";
  assert.equal(reconcileBook("p", b.events, corrupt, fixtureTime).reconciled, false);
  const hidden = structuredClone(b.journal);
  // Both entries still balance and offset, but no longer represent the source buy.
  for (const index of [1, 2]) {
    hidden[index]!.lines[0]!.amount = "1001.00";
    hidden[index]!.lines[2]!.amount = "1006.00";
  }
  assert.equal(reconcileBook("p", b.events, hidden, fixtureTime).reconciled, false);
});
test("fractional share loss and fee/price edge cases fail explicitly", () => {
  const b = book();
  b.post({ kind: "deposit", currency: "USD", amount: "10" });
  b.post({ kind: "buy", ...asset, quantity: "0.00000001", unitPrice: "1000000" });
  assert.throws(
    () =>
      b.post({
        kind: "split",
        instrumentId: asset.instrumentId,
        instrumentRevision: 1,
        ratio: "0.5",
        evidenceRef: "authored reverse split",
      }),
    /precision/,
  );
  assert.throws(
    () => b.post({ kind: "buy", ...asset, quantity: "0.00000001", unitPrice: "0.01" }),
    /rounds to zero/,
  );
  assert.throws(() => b.post({ kind: "fee", currency: "USD", amount: "20" }), /available cash/);
});
