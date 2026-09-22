import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { bookStateSchema } from "@portfolio-atlas/contracts";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";

test("book API posts once, reconciles, and atomically reverses plus replaces", async (t) => {
  const app = buildApp({ clock: { now: () => fixtureTime } });
  t.after(() => app.close());
  const post = (url: string, key: string, payload: object) =>
    app.inject({
      method: "POST",
      url: "/api/v1" + url,
      headers: { "idempotency-key": key },
      payload,
    });
  const mandate = (await post("/mandates", "book-mandate", demoMandate)).json().data;
  const portfolio = (
    await post("/portfolios", "book-portfolio", { name: "Book lesson", mandateId: mandate.id })
  ).json().data;
  const candidates = (await app.inject("/api/v1/instruments/search?q=AURA")).json().data.candidates;
  const instrument = (
    await post("/instruments/resolutions", "book-resolve", {
      candidateId: candidates[0].candidateId,
    })
  ).json().data.instrument;
  const base = { portfolioId: portfolio.id, occurredAt: "2026-09-01T15:00:00Z" };
  const deposit = {
    ...base,
    kind: "deposit",
    currency: "USD",
    amount: "10000",
    sourceRef: "deposit-lesson",
  };
  const deposited = await post("/ledger/events", "book-deposit", deposit);
  assert.equal(deposited.statusCode, 201, deposited.body);
  const buy = {
    ...base,
    occurredAt: "2026-09-02T15:00:00Z",
    kind: "buy",
    currency: "USD",
    quantity: "10",
    unitPrice: "100",
    fee: "5",
    sourceRef: "buy-lesson",
    instrumentId: instrument.instrumentId,
    instrumentRevision: 1,
  };
  const bought = await post("/ledger/events", "book-buy", buy);
  assert.equal(bought.statusCode, 201, bought.body);
  const state = bookStateSchema.parse(bought.json().data);
  assert.equal(state.book.cash[0]!.settled, "8995.00");
  assert.equal(state.book.positions[0]!.quantity, "10.00000000");
  assert.equal(state.book.reconciled, true);
  assert.equal(state.events[1]!.instrumentSnapshot?.instrumentId, instrument.instrumentId);
  assert.deepEqual((await post("/ledger/events", "book-buy", buy)).json().data, state);
  const duplicate = await post("/ledger/events", "book-buy-source-replay", buy);
  assert.equal(duplicate.json().data.events.length, 2);
  assert.equal(
    (await post("/ledger/events", "book-conflict", { ...buy, quantity: "11" })).statusCode,
    409,
  );
  const correction = {
    portfolioId: portfolio.id,
    originalEventId: state.events[1]!.id,
    reason: "Correct the imported share quantity",
    replacement: { ...buy, quantity: "8000", sourceRef: "replacement-buy" },
  };
  assert.equal(
    (await post("/ledger/corrections", "book-invalid-correction", correction)).statusCode,
    409,
  );
  assert.equal(
    (await app.inject("/api/v1/portfolios/" + portfolio.id + "/book")).json().data.events.length,
    2,
  );
  const corrected = await post("/ledger/corrections", "book-good-correction", {
    ...correction,
    replacement: { ...correction.replacement, quantity: "8" },
  });
  assert.equal(corrected.statusCode, 201, corrected.body);
  assert.equal(corrected.json().data.events.length, 4);
  assert.equal(corrected.json().data.book.cash[0].settled, "9195.00");
  assert.equal(corrected.json().data.book.positions[0].quantity, "8.00000000");
  assert.equal(corrected.json().data.book.reconciled, true);
  assert.deepEqual(corrected.json().data.journal[1], state.journal[1]);
  assert.equal(
    (
      await post("/ledger/events", "book-backdated", {
        ...deposit,
        occurredAt: "2026-08-01T00:00:00Z",
        sourceRef: "backdated",
      })
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await post("/ledger/events", "book-float-money", {
        ...deposit,
        amount: 100,
        sourceRef: "bad-number",
      })
    ).statusCode,
    400,
  );
});
