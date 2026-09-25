import { test, expect } from "../helpers/clock.js";
import { mkdir } from "node:fs/promises";
test("candle desk preserves rejected rows, explains gaps and exposes immutable evidence", async ({
  page,
}) => {
  const search = (await (await page.request.get("/api/v1/instruments/search?q=AURA")).json()).data;
  await page.request.post("/api/v1/instruments/resolutions", {
    headers: { "idempotency-key": "browser-quality-resolve" },
    data: { candidateId: search.candidates[0].candidateId },
  });
  await page.goto("/#market-data");
  await page.getByLabel("Saved instrument").selectOption("DEMO-AURORA");
  await page.getByRole("button", { name: "Ingest daily candles" }).click();
  await expect(
    page.getByRole("heading", { name: /What can the calculations trust/ }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(12);
  await expect(page.getByTestId("accepted-candle")).toHaveCount(4);
  await expect(page.getByText("2026-09-15: unknown", { exact: false })).toBeVisible();
  await page.getByLabel("Filter row reason").selectOption("HIGH_BELOW_BODY");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("100 / 99 / 98 / 101");
  await page.getByLabel("Filter row reason").selectOption("MISSING_VOLUME");
  await expect(page.locator("tbody")).toContainText("Accepted");
  await expect(page.locator("tbody")).toContainText("Missing");
  await page.getByLabel("Filter row reason").selectOption("all");
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/chapter-3-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-3-mobile.png", fullPage: true });
  await page.getByLabel("Synthetic fixture").selectOption("clean");
  await page.getByRole("button", { name: "Ingest daily candles" }).click();
  await expect(page.getByTestId("accepted-candle")).toHaveCount(12);
  await page.reload();
  await page.getByLabel("Saved dataset").selectOption({ label: "AURA · adversarial · revision 1" });
  await expect(page.getByTestId("accepted-candle")).toHaveCount(4);
});
