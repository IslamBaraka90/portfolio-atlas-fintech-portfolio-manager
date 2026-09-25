import { expect, test } from "../helpers/clock.js";
import { seedTrading } from "../helpers/seed-trading.js";

test("live fills desk offers live quotes to accepted orders and shows costs", async ({
  page,
  serverNow,
}) => {
  const get = async (path: string) =>
    (await (await page.request.get("/api/v1" + path)).json()).data;
  const post = async (path: string, key: string, data: object) => {
    const r = await page.request.post("/api/v1" + path, {
      headers: { "idempotency-key": key },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()).data;
  };
  const seed = await seedTrading(get, post, "browser-live-fill", serverNow);
  await post("/live/cycles", "browser-live-fill-quotes", {});
  const board = await get("/live/quotes");
  const ask = (symbol: string) =>
    board.quotes.find((q: { symbol: string }) => q.symbol === symbol).ask.toFixed(2);
  seed.input.newPrices = seed.input.newPrices.map((p, i) => ({
    ...p,
    price: ask(seed.instruments[i]!.returnedSymbol),
  }));
  const live = await get("/portfolios/" + seed.portfolio.id + "/live-nav");
  seed.input.valuation = { id: live.latest.valuation.id, revision: 1 };
  const plan = await post("/rebalances", "browser-live-fill-plan", seed.input);
  const approved = await post("/rebalances/" + plan.id + "/approval", "browser-live-fill-approve", {
    expectedRevision: 1,
  });
  let batch = await post("/paper-batches", "browser-live-fill-submit", {
    proposal: { id: plan.id, revision: approved.revision },
    clientBatchId: "browser-live-fill-batch",
  });
  for (const [i, order] of batch.orders.entries())
    batch = await post("/paper-batches/" + batch.id + "/events", "browser-live-fill-accept-" + i, {
      eventId: "browser-live-accept-" + i,
      expectedRevision: batch.revision,
      orderId: order.id,
      kind: "accept",
    });

  await page.goto("/#live-fills");
  await expect(
    page.getByRole("heading", { name: /What would this order have cost/ }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Paper batch" })
    .selectOption({ label: "browser-live-fill-batch · active" });
  await page.getByRole("button", { name: "Offer live quotes" }).click();
  // Depending on the real clock the market is open (fills) or closed (orders wait).
  await expect(page.getByRole("status").filter({ hasText: "Last cycle:" })).toContainText(
    /open paper order\(s\) filled at live quotes/,
  );
  const blotter = page.getByRole("region", { name: "Live blotter" });
  await expect(blotter.getByRole("row")).toHaveCount(batch.orders.length + 1);
  await expect(page.getByRole("region", { name: "Execution costs" })).toContainText(
    "chapter-24.quote-fill.v1",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});
