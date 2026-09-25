import { expect, test } from "../helpers/clock.js";

test("live quote board records demo quotes, an unavailable symbol and an append-only tape", async ({
  page,
}) => {
  await page.goto("/#quotes");
  await expect(
    page.getByRole("heading", { name: "Is this price live, delayed or stale?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh quotes" }).click();
  const board = page.locator("table.quote-board");
  await expect(
    board.getByRole("button", { name: "Show tape for AURA", exact: true }),
  ).toBeVisible();
  await expect(board.getByRole("row").filter({ hasText: "AURA.L" })).toContainText("GBP");

  await page.getByLabel("Add a symbol to the watchlist").fill("zzz");
  await page.getByRole("button", { name: "Add symbol" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added ZZZ" })).toBeVisible();
  await page.getByRole("button", { name: "Refresh quotes" }).click();
  const missing = board.getByRole("row").filter({ hasText: "ZZZ" });
  await expect(missing).toContainText("Unavailable");
  await expect(missing).toContainText("Not a synthetic teaching symbol.");

  await board.getByRole("button", { name: "Show tape for AURA", exact: true }).click();
  const tape = page.getByRole("region", { name: "Quote tape · AURA" });
  // The shared test server's scheduler may add cycles; at least our two refreshes exist.
  await expect.poll(() => tape.getByRole("row").count()).toBeGreaterThanOrEqual(3);
  await expect(tape).toContainText("chapter-19.quote-freshness.v1");

  await missing.getByRole("button", { name: "Remove ZZZ" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Removed ZZZ" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});
