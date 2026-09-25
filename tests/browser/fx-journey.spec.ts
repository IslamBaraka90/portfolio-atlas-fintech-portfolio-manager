import { expect, test } from "../helpers/clock.js";

test("live FX desk derives the needed pair and converts with board evidence", async ({ page }) => {
  await page.goto("/#fx");
  await expect(
    page.getByRole("heading", { name: "Which rate converts this holding, and how old is it?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh FX" }).click();
  const board = page.getByRole("region", { name: "FX board" });
  const gbp = board.getByRole("row").filter({ hasText: "GBP → USD" });
  await expect(gbp).toContainText("1.27");
  await expect(gbp).toContainText("Direct leg");
  await expect(gbp).toContainText("GBPUSD=X");

  const convert = page.getByRole("region", { name: "Convert with the board's evidence" });
  await convert.getByLabel("Amount").fill("100");
  await convert.getByRole("button", { name: "Convert" }).click();
  await expect(convert.getByRole("status")).toContainText("127.00 USD");
  await convert.getByLabel("From").selectOption("EUR");
  await convert.getByRole("button", { name: "Convert" }).click();
  await expect(convert.getByRole("alert")).toContainText("No live rate for EUR→USD");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});
