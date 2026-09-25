import { expect, test } from "../helpers/clock.js";

test("live history desk records demo series with finality evidence and a candle view", async ({
  page,
}) => {
  await page.goto("/#bars");
  await expect(page.getByRole("heading", { name: "When is a live bar final?" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh history" }).click();
  await expect(page.getByLabel("Symbol")).toBeVisible();
  await page.getByLabel("Symbol").selectOption("AURA");
  await page.getByLabel("Interval").selectOption("1d");
  await expect(page.getByText("chapter-20.live-bars.v1")).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Live candles\. Final bars are solid/ }),
  ).toBeVisible();
  const latest = page.getByRole("region", { name: "Latest bars" });
  await expect(latest.getByRole("row").nth(1)).toContainText(/Final|Forming/);
  await expect(latest).toContainText("Daily bar ends at the 16:00 session close.");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});
