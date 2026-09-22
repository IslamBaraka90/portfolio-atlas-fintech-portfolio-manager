import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
import { paperBatchSchema } from "@portfolio-atlas/contracts";
import { seedTrading } from "../../../tests/helpers/seed-trading.js";
test("paper submission consumes approval once and commits resources until broker acknowledgment", async (t) => {
  const app = buildApp({ clock: { now: () => fixtureTime } });
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
  const seed = await seedTrading(get, post, "paper-pretrade", () => fixtureTime);
  const p = await post("/rebalances", "paper-plan", seed.input);
  const approved = await post("/rebalances/" + p.id + "/approval", "paper-approval", {
    expectedRevision: 1,
  });
  const input = {
    proposal: { id: p.id, revision: approved.revision },
    clientBatchId: "paper-client-001",
  };
  let batch = paperBatchSchema.parse(await post("/paper-batches", "paper-submit", input));
  assert.equal(batch.orders[0]!.state, "submitted");
  assert.equal((await post("/paper-batches", "paper-submit-retry", input)).id, batch.id);
  const id = batch.id,
    orderId = batch.orders[0]!.id;
  const event = { eventId: "paper-accept-001", expectedRevision: 1, orderId, kind: "accept" };
  batch = paperBatchSchema.parse(
    await post("/paper-batches/" + id + "/events", "paper-accept-command", event),
  );
  assert.equal(batch.orders[0]!.cashReserved, "3903.91");
  assert.equal(
    (await get("/portfolios/" + seed.portfolio.id + "/book")).book.cash[0].reserved,
    "3903.91",
  );
  assert.deepEqual(
    await post("/paper-batches/" + id + "/events", "paper-accept-replay", event),
    batch,
  );
  const blocked = await app.inject({
    method: "POST",
    url: "/api/v1/ledger/events",
    headers: { "idempotency-key": "paper-manual-deposit" },
    payload: {
      portfolioId: seed.portfolio.id,
      kind: "deposit",
      currency: "USD",
      amount: "1",
      occurredAt: fixtureTime,
      sourceRef: "manual-while-locked",
    },
  });
  assert.equal(blocked.statusCode, 409);
  assert.match(blocked.body, /locks manual/);
  batch = paperBatchSchema.parse(
    await post("/paper-batches/" + id + "/events", "paper-cancel-request", {
      eventId: "paper-cancel-001",
      expectedRevision: batch.revision,
      orderId,
      kind: "cancel_request",
    }),
  );
  assert.equal(batch.orders[0]!.state, "cancel_pending");
  assert.equal(batch.orders[0]!.cashReserved, "3903.91");
  batch = paperBatchSchema.parse(
    await post("/paper-batches/" + id + "/events", "paper-cancel-ack", {
      eventId: "paper-cancelack-001",
      expectedRevision: batch.revision,
      orderId,
      kind: "cancel_ack",
    }),
  );
  assert.equal(batch.orders[0]!.cashReserved, "0.00");
  assert.equal(batch.orders[0]!.state, "cancelled");
  batch = paperBatchSchema.parse(
    await post("/paper-batches/" + id + "/events", "paper-other-reject", {
      eventId: "paper-reject-001",
      expectedRevision: batch.revision,
      orderId: batch.orders[1]!.id,
      kind: "reject",
    }),
  );
  assert.equal(batch.status, "complete");
  assert.equal(
    (await get("/portfolios/" + seed.portfolio.id + "/book")).book.cash[0].reserved,
    "0.00",
  );
});
