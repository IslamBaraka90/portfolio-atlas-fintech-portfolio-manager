import { test, expect } from "@playwright/test";
import { demoMandate } from "@portfolio-atlas/testing";
import { mkdir } from "node:fs/promises";
test("instrument explorer distinguishes listings, units, eligibility and ticker continuity", async ({
  page,
}) => {
  await page.request.post("/api/v1/mandates", {
    headers: { "idempotency-key": "instrument-browser-mandate" },
    data: demoMandate,
  });
  await page.goto("/#instruments");
  await page.getByRole("button", { name: "Search instruments" }).click();
  await expect(page.getByRole("button", { name: /Aurora Systems.*US common/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Aurora Systems.*UK preferred/ })).toBeVisible();
  await page.getByRole("button", { name: /Aurora Systems.*US common/ }).click();
  await expect(
    page.getByRole("heading", { name: "Aurora Systems · US common", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Evaluate eligibility" }).click();
  await expect(
    page.getByRole("heading", { name: "Eligibility: eligible", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Aurora Systems.*UK preferred/ }).click();
  await expect(page.getByText("GBp → GBP × 0.01", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Evaluate eligibility" }).click();
  await expect(
    page.getByRole("heading", { name: "Eligibility: unresolved", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Old ticker before change" }).click();
  await expect(page.locator(".alias-result")).toContainText("DEMO-AURORA-US");
  await page.getByRole("button", { name: "Old ticker at change" }).click();
  await expect(page.locator(".alias-result")).toContainText("unmapped");
  await page.getByRole("button", { name: "New ticker at change" }).click();
  await expect(page.locator(".alias-result")).toContainText("DEMO-AURORA-US");
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/chapter-2-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-2-mobile.png", fullPage: true });
});
test("disabled Yahoo does not silently display synthetic candidates", async ({ page }) => {
  await page.goto("/#instruments");
  await page.getByLabel("Data source").selectOption("yahoo");
  await page.getByLabel("Company or symbol").fill("AAPL");
  await page.getByRole("button", { name: "Search instruments" }).click();
  await expect(page.getByText("Provider unavailable · DISABLED")).toBeVisible();
  await expect(page.getByRole("button", { name: /Aurora Systems/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Mandate lab/ }).click();
  await expect(page.getByRole("heading", { name: /Define the rules/ })).toBeVisible();
});
