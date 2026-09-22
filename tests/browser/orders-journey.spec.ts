import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { seedTrading } from "../helpers/seed-trading.js";
test("paper blotter preserves one fill after a lost response and exposes cancel acknowledgment and rejection", async ({
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
  const seed = await seedTrading(get, post, "browser-paper", () => new Date().toISOString());
  const p = await post("/rebalances", "browser-paper-plan", seed.input);
  await post("/rebalances/" + p.id + "/approval", "browser-paper-approval", {
    expectedRevision: 1,
  });
  await page.goto("/#orders");
  await page.getByRole("combobox", { name: "Execution proposal", exact: true }).selectOption(p.id);
  await page.getByRole("button", { name: "Submit paper batch", exact: true }).click();
  const detail = page.getByTestId("paper-order");
  await expect(
    detail.getByRole("heading", { name: "Order state: submitted", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Broker accepts order", exact: true }).click();
  await expect(
    detail.getByRole("heading", { name: "Order state: accepted", exact: true }),
  ).toBeVisible();
  let lost = true;
  await page.route("**/api/v1/paper-batches/*/events", async (route) => {
    if (lost && route.request().postDataJSON().kind === "opening") {
      lost = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Simulate opening event", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("API is unavailable");
  await page.getByRole("button", { name: "Retry last event", exact: true }).click();
  await expect(
    detail.getByRole("heading", { name: "Order state: partially_filled", exact: true }),
  ).toBeVisible();
  expect((await get("/portfolios/" + seed.portfolio.id + "/book")).book.positions[0].quantity).toBe(
    "4.00000000",
  );
  await page.getByRole("button", { name: "Request cancellation", exact: true }).click();
  await expect(
    detail.getByRole("heading", { name: "Order state: cancel_pending", exact: true }),
  ).toBeVisible();
  await expect(detail).toContainText("3503.51");
  await page.getByRole("button", { name: "Acknowledge cancellation", exact: true }).click();
  await expect(
    detail.getByRole("heading", { name: "Order state: cancelled", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inspect paper order DEMO-HARBOR", exact: true }).click();
  await page.getByRole("button", { name: "Broker accepts order", exact: true }).click();
  await expect(
    detail.getByRole("heading", { name: "Order state: accepted", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Paper opening price").fill("101");
  await page.getByRole("button", { name: "Simulate opening event", exact: true }).click();
  await expect(
    detail.getByRole("heading", { name: "Order state: rejected", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Paper batch: complete", exact: true }),
  ).toBeVisible();
  expect((await get("/portfolios/" + seed.portfolio.id + "/book")).book.cash[0].reserved).toBe(
    "0.00",
  );
  await page.getByRole("button", { name: "Inspect paper order DEMO-AURORA", exact: true }).click();
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-12-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-12-mobile.png", fullPage: true });
});
