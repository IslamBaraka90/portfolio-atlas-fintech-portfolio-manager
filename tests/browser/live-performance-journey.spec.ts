import { expect, test } from "../helpers/clock.js";
import { seedLivePortfolio } from "../helpers/seed-live.js";

test("live performance desk explains its measurement and the replay workflow", async ({
  page,
  serverNow,
}) => {
  await seedLivePortfolio(
    page.request,
    serverNow,
    "live-performance-journey",
    "Live performance lesson",
  );
  await page.goto("/#live-performance");
  await expect(page.getByRole("heading", { name: /How did the live portfolio do/ })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Portfolio" })
    .selectOption({ label: "Live performance lesson" });
  const panel = page.getByRole("region", { name: "Performance against the benchmark" });
  await expect(panel).toContainText("chapter-25.live-performance.v1");
  await expect(panel).toContainText("Time-weighted return, net of recorded fees");
  await expect(panel).toContainText(/price return/);
  await expect(page.getByRole("region", { name: "Record and replay" })).toContainText(
    "DEMO_CACHE_PATH",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});
