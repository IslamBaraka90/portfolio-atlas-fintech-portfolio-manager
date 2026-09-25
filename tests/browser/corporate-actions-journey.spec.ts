import { test, expect } from "../helpers/clock.js";
import { mkdir } from "node:fs/promises";
test("corporate-action desk separates price bases, cutoff revisions and parent lineage", async ({
  page,
}) => {
  const search = (await (await page.request.get("/api/v1/instruments/search?q=AURA")).json()).data;
  const instrument = (
    await (
      await page.request.post("/api/v1/instruments/resolutions", {
        headers: { "idempotency-key": "browser-actions-resolve" },
        data: { candidateId: search.candidates[0].candidateId },
      })
    ).json()
  ).data.instrument;
  const dataset = (
    await (
      await page.request.post("/api/v1/market-data/ingestions", {
        headers: { "idempotency-key": "browser-actions-candles" },
        data: {
          instrumentId: instrument.instrumentId,
          instrumentRevision: instrument.revision,
          from: "2026-09-01",
          to: "2026-09-18",
          scenario: "corporate-actions",
        },
      })
    ).json()
  ).data.dataset;
  await page.goto("/#actions");
  await page.getByRole("button", { name: "Review action evidence" }).click();
  await expect(page.getByRole("cell", { name: "cancelled", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Build research views" }).click();
  await expect(page.getByRole("heading", { name: "03 / Research views: ready" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Split-adjusted with corporate action markers" }),
  ).toBeVisible();
  await expect(page.locator(".chapter-metrics strong").first()).toHaveText("50");
  await page.getByLabel("Price basis", { exact: true }).selectOption("providerClose");
  await expect(page.locator(".chapter-metrics strong").first()).toHaveText("100");
  await page.getByLabel("Price basis", { exact: true }).selectOption("totalReturnClose");
  await expect(page.locator(".chapter-metrics strong").first()).toHaveText("48.076923");
  await expect(page.getByText(/1 USD = 0.9 EUR/)).toBeVisible();
  await page.getByLabel("Action knowledge cutoff (UTC)").selectOption("2026-09-16T00:00:00Z");
  await page.getByRole("button", { name: "Build research views" }).click();
  await expect(page.locator(".chapter-metrics strong").first()).toHaveText("47.619048");
  await expect(page.locator(".chapter-metrics strong").last()).toHaveText("2");
  await expect(page.getByText("Archive diagnosis: basis-drift.", { exact: false })).toBeVisible();
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-4-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/chapter-4-mobile.png", fullPage: true });
  await page.getByLabel("Action knowledge cutoff (UTC)").selectOption("2026-09-21T00:00:00Z");
  await page.getByRole("button", { name: "Build research views" }).click();
  await expect(page.locator(".chapter-metrics strong").first()).toHaveText("50");
  await page.getByRole("link", { name: dataset.id + " · revision 1" }).click();
  await expect(
    page.getByRole("heading", { name: /What can the calculations trust/ }),
  ).toBeVisible();
  await expect(page.getByTestId("accepted-candle")).toHaveCount(12);
  await expect(page.locator("tbody tr").first()).toContainText("99.5 / 101 / 99 / 100");
});
