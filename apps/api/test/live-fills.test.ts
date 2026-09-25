import assert from "node:assert/strict";
import test from "node:test";
import { paperBatchSchema } from "@portfolio-atlas/contracts";
import { buildApp } from "../src/app.js";
import { seedTrading } from "../../../tests/helpers/seed-trading.js";

async function setup(start: string) {
  let now = start;
  const app = buildApp({ clock: { now: () => now } });
  const get = async (path: string) => (await app.inject("/api/v1" + path)).json().data;
  const post = async (path: string, key: string, payload: object = {}) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      headers: { "idempotency-key": key },
      payload,
    });
    assert.ok(r.statusCode < 300, r.body);
    return r.json().data;
  };
  const seed = await seedTrading(get, post, "live-fill", () => now);
  // Quote the saved instruments, then approve a proposal priced at those quotes.
  await post("/live/cycles", "live-fill-quotes");
  const board = await get("/live/quotes");
  // Live proposals are priced at the executable side: the ask for these buys.
  const ask = (symbol: string) =>
    board.quotes.find((q: { symbol: string }) => q.symbol === symbol).ask.toFixed(2);
  seed.input.newPrices = seed.input.newPrices.map((p, i) => ({
    ...p,
    price: ask(seed.instruments[i]!.returnedSymbol),
  }));
  // The cycle also valued the book live; a proposal must use that latest valuation.
  const live = await get("/portfolios/" + seed.portfolio.id + "/live-nav");
  seed.input.valuation = { id: live.latest.valuation.id, revision: 1 };
  const plan = await post("/rebalances", "live-fill-plan", seed.input);
  const approved = await post("/rebalances/" + plan.id + "/approval", "live-fill-approval", {
    expectedRevision: 1,
  });
  let batch = paperBatchSchema.parse(
    await post("/paper-batches", "live-fill-submit", {
      proposal: { id: plan.id, revision: approved.revision },
      clientBatchId: "live-fill-batch-001",
    }),
  );
  for (const [i, order] of batch.orders.entries())
    batch = paperBatchSchema.parse(
      await post("/paper-batches/" + batch.id + "/events", "live-fill-accept-" + i, {
        eventId: "live-accept-" + i,
        expectedRevision: batch.revision,
        orderId: order.id,
        kind: "accept",
      }),
    );
  return {
    app,
    get,
    post,
    batch,
    advance: (ms: number) => (now = new Date(Date.parse(now) + ms).toISOString()),
  };
}

test("accepted paper orders fill at live quotes once, with costs against the decision", async (t) => {
  const s = await setup("2026-09-24T15:07:30.000Z");
  t.after(() => s.app.close());
  assert.ok(s.batch.orders.length > 0);
  // One second later the demo quote (per minute) is unchanged, so the ask still
  // equals the decision price and the protected market orders fill.
  s.advance(1_000);
  const cycle = await s.post("/live/cycles", "live-fill-cycle-1");
  const paperTask = cycle.tasks.find((x: { name: string }) => x.name === "paper");
  assert.match(paperTask.detail, /filled at live quotes/);
  const batch = paperBatchSchema.parse(await s.get("/paper-batches/" + s.batch.id));
  const fills = batch.orders.flatMap((o) => o.fills);
  assert.ok(fills.length > 0, paperTask.detail);
  const fill = fills[0]!;
  const order = batch.orders.find((o) => o.fills.includes(fill))!;
  assert.equal(fill.source, "live_quote_paper_fill");
  assert.equal(fill.live?.basis, order.side === "buy" ? "ask" : "bid");
  assert.equal(Number(fill.price), order.side === "buy" ? fill.live!.ask : fill.live!.bid);

  // Replaying the cycle at the same instant offers the same quote: no second fill.
  const replay = await s.post("/live/cycles", "live-fill-cycle-2");
  const again = paperBatchSchema.parse(await s.get("/paper-batches/" + s.batch.id));
  assert.equal(again.orders.flatMap((o) => o.fills).length, fills.length);
  assert.ok(replay.tasks.find((x: { name: string }) => x.name === "paper"));

  const costs = await s.get("/paper-batches/" + s.batch.id + "/costs");
  const cost = costs.find((c: { orderId: string }) => c.orderId === order.id);
  assert.equal(cost.liveFills, order.fills.length);
  assert.equal(cost.method, "application arithmetic; chapter-24.quote-fill.v1");
  // Independent check of the shortfall for the first fill.
  const sign = order.side === "buy" ? 1 : -1;
  const expected = order.fills
    .reduce(
      (sum, f) =>
        sum + Number(f.quantity) * (Number(f.price) - Number(order.protectionPrice)) * sign,
      0,
    )
    .toFixed(2);
  assert.equal(cost.shortfall, expected === "-0.00" ? "0.00" : expected);
});

test("a closed market leaves accepted orders waiting", async (t) => {
  const s = await setup("2026-09-26T15:07:30.000Z"); // Saturday
  t.after(() => s.app.close());
  s.advance(1_000);
  const cycle = await s.post("/live/cycles", "live-fill-closed");
  const paperTask = cycle.tasks.find((x: { name: string }) => x.name === "paper");
  assert.match(paperTask.detail, /^0 of \d+ open paper order\(s\) filled/);
  assert.match(paperTask.detail, /Market closed: the order waits for the next open cycle\./);
  const batch = paperBatchSchema.parse(await s.get("/paper-batches/" + s.batch.id));
  assert.equal(batch.orders.flatMap((o) => o.fills).length, 0);
});

test("a quote that moves beyond the decision price is rejected by protection", async (t) => {
  const s = await setup("2026-09-24T15:07:30.000Z");
  t.after(() => s.app.close());
  // Find a later minute whose demo ask is above the approved decision price.
  const decision = Number(s.batch.orders[0]!.protectionPrice);
  let detail = "";
  for (let minute = 1; minute <= 20 && !/rejected by price protection/.test(detail); minute++) {
    s.advance(60_000);
    const cycle = await s.post("/live/cycles", "live-fill-move-" + minute);
    detail = cycle.tasks.find((x: { name: string }) => x.name === "paper").detail;
  }
  assert.match(detail, /rejected by price protection/);
  const batch = paperBatchSchema.parse(await s.get("/paper-batches/" + s.batch.id));
  const rejected = batch.orders.find((o) => o.state === "rejected")!;
  assert.ok(rejected, "an order was rejected");
  assert.equal(rejected.fills.length, 0);
  assert.ok(decision > 0);
  assert.match(rejected.history.at(-1)!.reason, /exceeded the approved price protection/);
});
