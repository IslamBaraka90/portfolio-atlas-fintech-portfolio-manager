import { expect, test } from "@playwright/test";
import { seedLivePortfolio } from "../helpers/seed-live.js";

test("live risk desk shows measures, the monitor outcome and their evidence", async ({ page }) => {
  await seedLivePortfolio(page.request, "live-risk-journey", "Live risk lesson");
  await page.goto("/#live-risk");
  await expect(page.getByRole("heading", { name: /Has the live portfolio drifted/ })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Portfolio" })
    .selectOption({ label: "Live risk lesson" });
  const panel = page.getByRole("region", { name: "Portfolio risk" });
  await expect(panel).toContainText("Beta to ATLS");
  await expect(panel).toContainText("chapter-23.live-risk.v1");
  await expect(panel).toContainText(/aligned final daily returns/);
  await expect(panel.getByRole("row").filter({ hasText: "AURA" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Monitoring & alerts" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});
