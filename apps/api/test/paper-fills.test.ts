import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
import { paperBatchSchema, type PaperEvent } from "@portfolio-atlas/contracts";
import { seedTrading } from "../../../tests/helpers/seed-trading.js";
test("4 then 6 fills stay 10 through cancel races, event replay, transaction failure and restart", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "atlas-paper-")),
    databasePath = join(directory, "book.sqlite");
  let now = fixtureTime,
    app = buildApp({ databasePath, clock: { now: () => now } });
  t.after(async () => {
    await app.close();
    const target = resolve(directory),
      root = resolve(tmpdir()) + sep;
    if (!target.startsWith(root) || !target.split(sep).at(-1)!.startsWith("atlas-paper-"))
      throw new Error("Unexpected cleanup target");
    rmSync(target, { recursive: true, force: true });
  });
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
  const seed = await seedTrading(get, post, "paper-fill", () => now);
  const p = await post("/rebalances", "paper-fill-plan", {
    ...seed.input,
    newPrices: seed.input.newPrices.map((p) => ({ ...p, price: "390" })),
  });
  assert.equal(p.trades[0].quantity, "10.00000000");
  const approved = await post("/rebalances/" + p.id + "/approval", "paper-fill-approve", {
    expectedRevision: 1,
  });
  let batch = paperBatchSchema.parse(
    await post("/paper-batches", "paper-fill-submit", {
      proposal: { id: p.id, revision: approved.revision },
      clientBatchId: "paper-fill-client",
    }),
  );
  const id = batch.id,
    orderId = batch.orders[0]!.id,
    path = "/paper-batches/" + id + "/events";
  const apply = async (
    eventId: string,
    kind: PaperEvent["kind"],
    opening: PaperEvent["opening"] = null,
  ) => {
    batch = paperBatchSchema.parse(
      await post(path, eventId + "-command", {
        eventId,
        expectedRevision: batch.revision,
        orderId,
        kind,
        opening,
      }),
    );
    return batch;
  };
  await apply("paper-fill-accept", "accept");
  now = "2026-09-22T10:00:01.000Z";
  const input = {
    eventId: "paper-fill-first",
    expectedRevision: batch.revision,
    orderId,
    kind: "opening",
    opening: { at: now, price: "390", capacity: 4 },
  };
  const sql = new DatabaseSync(databasePath);
  sql.exec(
    "CREATE TRIGGER fail_paper_fill BEFORE INSERT ON journal_lines WHEN NEW.account='investment_cost' BEGIN SELECT RAISE(ABORT,'injected fill failure'); END;",
  );
  const failed = await app.inject({
    method: "POST",
    url: "/api/v1" + path,
    headers: { "idempotency-key": "paper-fill-first-command" },
    payload: input,
  });
  assert.equal(failed.statusCode, 500);
  const unchanged = await get("/paper-batches/" + id);
  assert.equal(unchanged.revision, batch.revision);
  assert.equal(unchanged.orders[0].cashReserved, "3903.91");
  assert.equal((await get("/portfolios/" + seed.portfolio.id + "/book")).book.positions.length, 0);
  sql.exec("DROP TRIGGER fail_paper_fill");
  sql.close();
  batch = paperBatchSchema.parse(await post(path, "paper-fill-first-command", input));
  assert.equal(batch.orders[0]!.filledQuantity, "4.00000000");
  assert.equal(batch.orders[0]!.remainingQuantity, "6.00000000");
  assert.equal(batch.orders[0]!.cashReserved, "2342.35");
  assert.equal(batch.orders[0]!.fees, "1.56");
  const firstCheckpoint = batch.expectedBookCheckpoint;
  assert.deepEqual(await post(path, "paper-fill-first-replayed", input), batch);
  assert.equal(
    (await get("/portfolios/" + seed.portfolio.id + "/book")).book.checkpoint,
    firstCheckpoint,
  );
  await app.close();
  app = buildApp({ databasePath, clock: { now: () => now } });
  assert.deepEqual(await get("/paper-batches/" + id), batch);
  assert.deepEqual(await post(path, "paper-fill-restart-replay", input), batch);
  await apply("paper-fill-cancel", "cancel_request");
  assert.equal(batch.orders[0]!.state, "cancel_pending");
  now = "2026-09-22T10:00:02.000Z";
  await apply("paper-fill-second", "opening", { at: now, price: "390", capacity: 6 });
  assert.equal(batch.orders[0]!.state, "filled");
  assert.equal(batch.orders[0]!.filledQuantity, "10.00000000");
  assert.equal(batch.orders[0]!.fees, "3.90");
  assert.equal(batch.orders[0]!.cashReserved, "0.00");
  await apply("paper-fill-late-ack", "cancel_ack");
  assert.equal(batch.orders[0]!.state, "filled");
  const book = await get("/portfolios/" + seed.portfolio.id + "/book");
  assert.equal(book.book.positions[0].quantity, "10.00000000");
  assert.equal(book.book.cash[0].settled, "6096.10");
  assert.equal(book.book.reconciled, true);
  const stale = await app.inject({
    method: "POST",
    url: "/api/v1" + path,
    headers: { "idempotency-key": "paper-stale-revision" },
    payload: { eventId: "paper-stale-event", expectedRevision: 1, orderId, kind: "reject" },
  });
  assert.equal(stale.statusCode, 409);
});
test("limit opening misses, ordered observations and protected market rejection do not invent fills", async (t) => {
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
  const seed = await seedTrading(get, post, "paper-limit", () => now);
  const p = await post("/rebalances", "paper-limit-plan", seed.input);
  await post("/rebalances/" + p.id + "/approval", "paper-limit-approve", { expectedRevision: 1 });
  let b = await post("/paper-batches", "paper-limit-submit", {
    proposal: { id: p.id, revision: 2 },
    clientBatchId: "paper-limit-client",
    orderType: "limit",
  });
  const path = "/paper-batches/" + b.id + "/events",
    orderId = b.orders[0].id;
  b = await post(path, "paper-limit-accept", {
    eventId: "paper-limit-accept",
    expectedRevision: b.revision,
    orderId,
    kind: "accept",
  });
  now = "2026-09-22T10:00:01.000Z";
  b = await post(path, "paper-limit-miss", {
    eventId: "paper-limit-miss",
    expectedRevision: b.revision,
    orderId,
    kind: "opening",
    opening: { at: now, price: "101", capacity: 20 },
  });
  assert.equal(b.orders[0].state, "accepted");
  assert.equal(b.orders[0].fills.length, 0);
  const repeatedTime = await app.inject({
    method: "POST",
    url: "/api/v1" + path,
    headers: { "idempotency-key": "paper-limit-old-time" },
    payload: {
      eventId: "paper-limit-old-time",
      expectedRevision: b.revision,
      orderId,
      kind: "opening",
      opening: { at: now, price: "100", capacity: 4 },
    },
  });
  assert.equal(repeatedTime.statusCode, 409);
  now = "2026-09-22T10:00:02.000Z";
  b = await post(path, "paper-limit-hit", {
    eventId: "paper-limit-hit",
    expectedRevision: b.revision,
    orderId,
    kind: "opening",
    opening: { at: now, price: "99", capacity: 4 },
  });
  assert.equal(b.orders[0].filledQuantity, "4.00000000");
  assert.equal(b.orders[0].fees, "0.40");
  b = await post(path, "paper-limit-request-cancel", {
    eventId: "paper-limit-request-cancel",
    expectedRevision: b.revision,
    orderId,
    kind: "cancel_request",
  });
  b = await post(path, "paper-limit-cancel-ack", {
    eventId: "paper-limit-cancel-ack",
    expectedRevision: b.revision,
    orderId,
    kind: "cancel_ack",
  });
  assert.equal(b.orders[0].cashReserved, "0.00");
  assert.equal(b.orders[0].remainingQuantity, "35.00000000");
});
