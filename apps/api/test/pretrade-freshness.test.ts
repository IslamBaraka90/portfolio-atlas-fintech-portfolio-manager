import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";
import { seedTrading } from "../../../tests/helpers/seed-trading.js";
test("stale quote and revoked restriction block an already approved proposal", async (t) => {
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
  const seed = await seedTrading(get, post, "fresh-pretrade", () => now);
  const p = await post("/rebalances", "fresh-plan", seed.input);
  await post("/rebalances/" + p.id + "/approval", "fresh-approve", { expectedRevision: 1 });
  const submit = (key: string) =>
    app.inject({
      method: "POST",
      url: "/api/v1/paper-batches",
      headers: { "idempotency-key": key },
      payload: { proposal: { id: p.id, revision: 2 }, clientBatchId: key },
    });
  now = "2026-09-22T11:00:01.000Z";
  assert.equal((await submit("fresh-stale-quote")).statusCode, 409);
  now = fixtureTime;
  const changed = await app.inject({
    method: "PUT",
    url: "/api/v1/mandates/" + seed.mandate.id,
    headers: { "idempotency-key": "fresh-restrict" },
    payload: {
      expectedRevision: 1,
      mandate: { ...demoMandate, restrictedInstrumentIds: ["DEMO-AURORA"] },
    },
  });
  assert.equal(changed.statusCode, 200, changed.body);
  assert.equal((await submit("fresh-revoked")).statusCode, 409);
  assert.equal((await get("/paper-batches")).length, 0);
});
test("unexecuted sale proceeds cannot fund buy acceptance; completed sells release real funding", async (t) => {
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
  const seed = await seedTrading(get, post, "funding-pretrade", () => now),
    asset = seed.instruments[0]!;
  await post("/ledger/events", "funding-initial-buy", {
    portfolioId: seed.portfolio.id,
    kind: "buy",
    instrumentId: asset.instrumentId,
    instrumentRevision: asset.revision,
    currency: "USD",
    quantity: "60",
    unitPrice: "100",
    occurredAt: now,
    sourceRef: "funding-initial-buy",
  });
  const valuation = await post("/valuations", "funding-current-value", {
    portfolioId: seed.portfolio.id,
    checkpoint: 2,
    asOf: now,
    prices: [],
    overrides: [seed.input.newPrices[0]],
  });
  const p = await post("/rebalances", "funding-plan", {
    ...seed.input,
    valuation: { id: valuation.id, revision: 1 },
    newPrices: [seed.input.newPrices[1]],
  });
  assert.equal(p.status, "ready");
  await post("/rebalances/" + p.id + "/approval", "funding-approve", { expectedRevision: 1 });
  let batch = await post("/paper-batches", "funding-submit", {
    proposal: { id: p.id, revision: 2 },
    clientBatchId: "funding-client",
  });
  const sell = batch.orders.find((o: { side: string }) => o.side === "sell"),
    buy = batch.orders.find((o: { side: string }) => o.side === "buy"),
    path = "/paper-batches/" + batch.id + "/events";
  const denied = await app.inject({
    method: "POST",
    url: "/api/v1" + path,
    headers: { "idempotency-key": "funding-premature" },
    payload: {
      eventId: "funding-premature",
      expectedRevision: batch.revision,
      orderId: buy.id,
      kind: "accept",
    },
  });
  assert.equal(denied.statusCode, 409);
  assert.match(denied.body, /Complete funding sells/);
  assert.equal(
    (await get("/portfolios/" + seed.portfolio.id + "/book")).book.cash[0].reserved,
    "0.00",
  );
  batch = await post(path, "funding-sell-accept", {
    eventId: "funding-sell-accept",
    expectedRevision: batch.revision,
    orderId: sell.id,
    kind: "accept",
  });
  assert.equal(
    batch.orders.find((o: { id: string }) => o.id === sell.id).sharesCommitted,
    "21.00000000",
  );
  now = "2026-09-22T10:00:01.000Z";
  batch = await post(path, "funding-sell-fill", {
    eventId: "funding-sell-fill",
    expectedRevision: batch.revision,
    orderId: sell.id,
    kind: "opening",
    opening: { at: now, price: "100", capacity: 21 },
  });
  batch = await post(path, "funding-buy-accept", {
    eventId: "funding-buy-accept",
    expectedRevision: batch.revision,
    orderId: buy.id,
    kind: "accept",
  });
  assert.equal(batch.orders.find((o: { id: string }) => o.id === buy.id).cashReserved, "3903.91");
});
