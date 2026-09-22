import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { seedTrading } from "../helpers/seed-trading.js";
test("rebalance review shows post-cost quantities, no-trade trigger, approval and stale-book rejection", async ({
  page,
}) => {
  const get = async (path: string) =>
    (await (await page.request.get("/api/v1" + path)).json()).data;
  const post = async (path: string, key: string, data: object) => {
    const r = await page.request.post("/api/v1" + path, {
      headers: { "idempotency-key": key },
      data,
    });
    expect(r.status(), await r.text()).toBe(201);
    return (await r.json()).data;
  };
  const seed = await seedTrading(get, post, "browser-rebalance", () => new Date().toISOString());
  await page.goto("/#rebalancing");
  await page
    .getByRole("combobox", { name: "Rebalance target", exact: true })
    .selectOption(seed.target.id);
  await page
    .getByRole("combobox", { name: "Rebalance valuation", exact: true })
    .selectOption(seed.valuation.id);
  await page.getByRole("button", { name: "Build rebalance proposal", exact: true }).click();
  const result = page.getByTestId("rebalance-result");
  await expect(
    result.getByRole("heading", { name: "Rebalance: ready", exact: true }),
  ).toBeVisible();
  await expect(result).toContainText("39.00000000");
  await expect(result).toContainText("2192.20");
  await page.getByRole("button", { name: "Approve paper-trade proposal", exact: true }).click();
  await expect(
    result.getByRole("heading", { name: "Rebalance: approved", exact: true }),
  ).toBeVisible();
  expect((await get("/portfolios/" + seed.portfolio.id + "/book")).book.checkpoint).toBe(1);
  await page
    .getByRole("combobox", { name: "Rebalance trigger", exact: true })
    .selectOption("calendar");
  await page.getByLabel("Due time (UTC ISO)").fill("2099-01-01T00:00:00Z");
  await page.getByRole("button", { name: "Build rebalance proposal", exact: true }).click();
  await expect(
    result.getByRole("heading", { name: "Rebalance: no_trade", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve paper-trade proposal", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("combobox", { name: "Rebalance trigger", exact: true })
    .selectOption("manual");
  await page.getByRole("button", { name: "Build rebalance proposal", exact: true }).click();
  await expect(
    result.getByRole("heading", { name: "Rebalance: ready", exact: true }),
  ).toBeVisible();
  await post("/ledger/events", "browser-rebalance-change", {
    portfolioId: seed.portfolio.id,
    kind: "deposit",
    currency: "USD",
    amount: "1",
    occurredAt: new Date().toISOString(),
    sourceRef: "browser-rebalance-change",
  });
  await page.getByRole("button", { name: "Approve paper-trade proposal", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("revision changed");
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/chapter-11-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-11-mobile.png", fullPage: true });
});
