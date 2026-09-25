import { test, expect } from "../helpers/clock.js";
import { mkdir } from "node:fs/promises";
test("causal validation desk exposes costs, next-open clocks, delisting and unavailable evidence", async ({
  page,
}) => {
  await page.goto("/#validation");
  await page.getByRole("button", { name: "Run causal validation", exact: true }).click();
  const result = page.getByTestId("validation-result");
  await expect(
    result.getByRole("heading", { name: "Validation: synthetic_experiment", exact: true }),
  ).toBeVisible();
  await expect(result).toContainText("10362.08");
  await expect(result).toContainText("2026-07-07T13:30:00Z");
  await expect(
    result.getByRole("button", { name: "Inspect holdout momentum 10 bps", exact: true }),
  ).toBeVisible();
  const clean = await page
    .getByRole("combobox", { name: "Saved validation run", exact: true })
    .inputValue();
  await page
    .getByRole("combobox", { name: "Historical scenario", exact: true })
    .selectOption("late-filing");
  await page.getByRole("button", { name: "Run causal validation", exact: true }).click();
  await expect(
    result.getByRole("heading", { name: "Validation: blocked", exact: true }),
  ).toBeVisible();
  await expect(result).toContainText("Information cutoff failed");
  await page
    .getByRole("combobox", { name: "Historical scenario", exact: true })
    .selectOption("delisted");
  await page.getByRole("button", { name: "Run causal validation", exact: true }).click();
  await expect(
    result.getByRole("heading", { name: "Validation: synthetic_experiment", exact: true }),
  ).toBeVisible();
  await expect(result).toContainText("forced_exit");
  await page
    .getByRole("combobox", { name: "Saved validation run", exact: true })
    .selectOption(clean);
  await page.getByRole("button", { name: "Inspect fold-1 momentum 10 bps", exact: true }).click();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/chapter-10-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-10-mobile.png", fullPage: true });
});
