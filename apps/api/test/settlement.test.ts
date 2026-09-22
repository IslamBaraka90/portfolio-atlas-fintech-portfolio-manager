import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
import { seedTrading } from "../../../tests/helpers/seed-trading.js";
test("deferred paper fills create obligations; partial custody updates the active batch and replay cannot pay twice", async (t) => {
  let now = fixtureTime;
  const app = buildApp({ clock: { now: () => now } });
  t.after(() => app.close());
  const get = async (path: string) => (await app.inject("/api/v1" + path)).json().data;
  const post = async (path: string, key: string, payload: object) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      headers: { "idempotency-key": key },
      payload,
    });
    assert.equal(r.statusCode, 201, r.body);
    return r.json().data;
  };
  const seed = await seedTrading(get, post, "deferred", () => now);
  const calendar = await post("/settlement-policies", "deferred-calendar", {
    name: "Authored zero-lag teaching calendar",
    lagBusinessDays: 0,
    from: "2026-09-01",
    to: "2026-09-30",
    holidays: ["2026-09-23"],
  });
  const p = await post("/rebalances", "deferred-plan", {
    ...seed.input,
    newPrices: seed.input.newPrices.map((p) => ({ ...p, price: "390" })),
  });
  await post("/rebalances/" + p.id + "/approval", "deferred-approve", { expectedRevision: 1 });
  let batch = await post("/paper-batches", "deferred-submit", {
    proposal: { id: p.id, revision: 2 },
    clientBatchId: "deferred-client",
    settlementPolicy: { id: calendar.id, revision: 1 },
  });
  const path = "/paper-batches/" + batch.id + "/events",
    orderId = batch.orders[0].id;
  batch = await post(path, "deferred-accept", {
    eventId: "deferred-accept",
    expectedRevision: batch.revision,
    orderId,
    kind: "accept",
  });
  now = "2026-09-22T10:00:01.000Z";
  batch = await post(path, "deferred-fill", {
    eventId: "deferred-fill",
    expectedRevision: batch.revision,
    orderId,
    kind: "opening",
    opening: { at: now, price: "390", capacity: 10 },
  });
  const fill = batch.orders[0].fills[0],
    bookPath = "/portfolios/" + seed.portfolio.id + "/book";
  let state = await get(bookPath);
  assert.equal(fill.settlementPolicy, "deferred_teaching");
  assert.equal(fill.dueDate, "2026-09-22");
  assert.equal(state.book.cash[0].settled, "10000.00");
  assert.equal(state.book.cash[0].economic, "6096.10");
  assert.equal(state.book.positions[0].quantity, "10.00000000");
  assert.equal(state.book.positions[0].custodyQuantity, "0.00000000");
  const first = {
    portfolioId: seed.portfolio.id,
    settlementId: fill.settlementId,
    expectedCheckpoint: state.book.checkpoint,
    kind: "settle",
    quantity: "9",
    sourceRef: "custodian-delivery-nine",
  };
  state = await post("/settlement-events", "deferred-nine", first);
  assert.equal(state.book.cash[0].settled, "6486.49");
  assert.equal(state.book.positions[0].custodyQuantity, "9.00000000");
  const currentBatch = await get("/paper-batches/" + batch.id);
  assert.equal(currentBatch.revision, batch.revision + 1);
  assert.equal(currentBatch.expectedBookCheckpoint, state.book.checkpoint);
  const stale = await app.inject({
    method: "POST",
    url: "/api/v1" + path,
    headers: { "idempotency-key": "deferred-stale-order" },
    payload: {
      eventId: "deferred-stale-order",
      expectedRevision: batch.revision,
      orderId: batch.orders[1].id,
      kind: "reject",
    },
  });
  assert.equal(stale.statusCode, 409);
  batch = await post(path, "deferred-reject-other", {
    eventId: "deferred-reject-other",
    expectedRevision: currentBatch.revision,
    orderId: batch.orders[1].id,
    kind: "reject",
  });
  assert.equal(batch.status, "complete");
  const blocked = await app.inject({
    method: "POST",
    url: "/api/v1/ledger/events",
    headers: { "idempotency-key": "deferred-manual-block" },
    payload: {
      portfolioId: seed.portfolio.id,
      kind: "deposit",
      currency: "USD",
      amount: "1",
      occurredAt: now,
      sourceRef: "deferred-manual-block",
    },
  });
  assert.equal(blocked.statusCode, 409);
  assert.match(blocked.body, /Deferred obligations/);
  state = await post("/settlement-events", "deferred-failure", {
    portfolioId: seed.portfolio.id,
    settlementId: fill.settlementId,
    expectedCheckpoint: state.book.checkpoint,
    kind: "fail",
    sourceRef: "custodian-failure-one",
    reason: "Authored final-share delivery failure",
  });
  assert.equal(state.book.settlements[0].status, "failed");
  state = await post("/settlement-events", "deferred-final", {
    portfolioId: seed.portfolio.id,
    settlementId: fill.settlementId,
    expectedCheckpoint: state.book.checkpoint,
    kind: "settle",
    quantity: "1",
    sourceRef: "custodian-delivery-final",
  });
  assert.equal(state.book.cash[0].settled, "6096.10");
  assert.equal(state.book.cash[0].pending, "0.00");
  assert.equal(state.book.positions[0].custodyQuantity, "10.00000000");
  const checkpoint = state.book.checkpoint;
  await post("/settlement-events", "deferred-nine-replay", first);
  assert.equal((await get(bookPath)).book.checkpoint, checkpoint);
  const valuation = await post("/valuations", "deferred-value", {
    portfolioId: seed.portfolio.id,
    checkpoint,
    asOf: now,
    prices: [],
    overrides: [{ ...seed.input.newPrices[0], price: "390", quotedAt: now }],
  });
  assert.equal(valuation.totals.nav, "9996.10");
  assert.equal((await get("/settlement-queue"))[0].book.settlements[0].status, "settled");
});
