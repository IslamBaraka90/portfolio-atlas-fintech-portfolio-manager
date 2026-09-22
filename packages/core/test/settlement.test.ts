import assert from "node:assert/strict";
import test from "node:test";
import {
  postingInputSchema,
  settlementPolicySchema,
  type LedgerEvent,
  type JournalEntry,
  type MarkEvidence,
} from "@portfolio-atlas/contracts";
import { syntheticInstruments, fixtureTime } from "@portfolio-atlas/testing";
import { postingEntry } from "../src/domain/accounting/project-book.js";
import { reconcileBook } from "../src/domain/accounting/reconcile-book.js";
import { valueBook } from "../src/domain/valuation/value-book.js";
import { settlementDueDate } from "../src/domain/settlement/due-date.js";
function book() {
  const events: LedgerEvent[] = [],
    journal: JournalEntry[] = [];
  function post(value: object) {
    const input = postingInputSchema.parse({
      portfolioId: "p",
      sourceRef: "settlement-" + events.length,
      occurredAt: fixtureTime,
      ...value,
    });
    const e: LedgerEvent = {
      id: "event-" + events.length,
      portfolioId: "p",
      sequence: events.length + 1,
      recordedAt: fixtureTime,
      input,
      instrumentSnapshot: "instrumentId" in input ? syntheticInstruments[0]! : null,
    };
    journal.push(postingEntry(events, e));
    events.push(e);
  }
  const state = () => ({ events, journal, book: reconcileBook("p", events, journal, fixtureTime) });
  const nav = () => {
    const b = state();
    const marks: MarkEvidence[] = b.book.positions.map((p) => ({
      instrumentId: p.instrumentId,
      currency: "USD",
      price: "10",
      status: "accepted",
      quotedAt: fixtureTime,
      observedAt: fixtureTime,
      dataset: null,
      rowId: null,
      sourceHash: null,
      reviewId: null,
      override: null,
      reasons: [],
    }));
    return valueBook(
      b,
      {
        portfolioId: "p",
        checkpoint: events.length,
        asOf: fixtureTime,
        maxPriceAgeSeconds: 1,
        prices: [],
        overrides: [],
        fxRuns: [],
      },
      "USD",
      marks,
      [],
    ).totals.nav;
  };
  return { post, state, nav };
}
const trade = {
  instrumentId: "DEMO-AURORA",
  instrumentRevision: 1,
  currency: "USD",
  quantity: "10",
  unitPrice: "10",
  fee: "1",
  dueDate: "2026-09-22",
  calendarId: "calendar",
  calendarRevision: 1,
};
test("deferred buy 10, settlement 9+1 and failure preserve NAV while cash and custody move", () => {
  const b = book();
  b.post({ kind: "deposit", currency: "USD", amount: "1000" });
  b.post({ ...trade, kind: "pending_buy", settlementId: "buy-one" });
  let state = b.state().book;
  assert.equal(state.cash[0]!.settled, "1000.00");
  assert.equal(state.cash[0]!.economic, "899.00");
  assert.equal(state.cash[0]!.available, "899.00");
  assert.equal(state.positions[0]!.quantity, "10.00000000");
  assert.equal(state.positions[0]!.custodyQuantity, "0.00000000");
  assert.equal(b.nav(), "999.00");
  assert.throws(
    () =>
      b.post({
        kind: "sell",
        instrumentId: "DEMO-AURORA",
        instrumentRevision: 1,
        currency: "USD",
        quantity: "1",
        unitPrice: "10",
      }),
    /must settle/,
  );
  b.post({ kind: "settlement", settlementId: "buy-one", quantity: "9" });
  state = b.state().book;
  assert.equal(state.cash[0]!.settled, "909.10");
  assert.equal(state.cash[0]!.pending, "-10.10");
  assert.equal(state.positions[0]!.custodyQuantity, "9.00000000");
  assert.equal(b.nav(), "999.00");
  b.post({
    kind: "settlement_failure",
    settlementId: "buy-one",
    reason: "Authored one-share delivery failure",
  });
  assert.equal(b.state().book.settlements[0]!.status, "failed");
  b.post({ kind: "settlement", settlementId: "buy-one", quantity: "1" });
  assert.equal(b.state().book.cash[0]!.settled, "899.00");
  assert.equal(b.state().book.settlements[0]!.status, "settled");
  assert.equal(b.nav(), "999.00");
  assert.equal(b.state().book.reconciled, true);
  assert.throws(
    () => b.post({ kind: "settlement", settlementId: "buy-one", quantity: "1" }),
    /already completed/,
  );
  b.post({
    ...trade,
    kind: "pending_sell",
    settlementId: "sell-one",
    quantity: "4",
    unitPrice: "12",
    fee: "0.48",
  });
  state = b.state().book;
  assert.equal(state.cash[0]!.settled, "899.00");
  assert.equal(state.cash[0]!.economic, "946.52");
  assert.equal(state.cash[0]!.available, "899.00");
  assert.equal(state.positions[0]!.quantity, "6.00000000");
  assert.equal(state.positions[0]!.custodyQuantity, "10.00000000");
  assert.throws(
    () =>
      b.post({ ...trade, kind: "pending_buy", settlementId: "unfunded", quantity: "90", fee: "0" }),
    /not cash funded/,
  );
  b.post({ kind: "settlement", settlementId: "sell-one", quantity: "4" });
  assert.equal(b.state().book.cash[0]!.settled, "946.52");
  assert.equal(b.state().book.positions[0]!.custodyQuantity, "6.00000000");
  assert.equal(b.state().book.reconciled, true);
});
test("authored business weekdays, holidays and coverage determine settlement dates", () => {
  const p = settlementPolicySchema.parse({
    id: "calendar",
    revision: 1,
    createdAt: fixtureTime,
    source: "authored_teaching_calendar",
    name: "Authored test calendar",
    lagBusinessDays: 1,
    from: "2026-09-01",
    to: "2026-09-30",
    holidays: ["2026-09-23"],
  });
  assert.equal(settlementDueDate("2026-09-22", p), "2026-09-24");
  assert.equal(settlementDueDate("2026-09-25", p), "2026-09-28");
  assert.equal(settlementDueDate("2026-09-26", { ...p, lagBusinessDays: 0 }), "2026-09-28");
  assert.throws(() => settlementDueDate("2026-09-30", p), /coverage/);
  const b = book();
  b.post({ kind: "deposit", currency: "USD", amount: "1000" });
  b.post({ ...trade, kind: "pending_buy", settlementId: "future", dueDate: "2026-09-24" });
  assert.throws(
    () => b.post({ kind: "settlement", settlementId: "future", quantity: "1" }),
    /earlier/,
  );
  assert.throws(
    () =>
      b.post({
        kind: "split",
        instrumentId: "DEMO-AURORA",
        instrumentRevision: 1,
        ratio: "2",
        evidenceRef: "split evidence",
      }),
    /Settle affected/,
  );
});
