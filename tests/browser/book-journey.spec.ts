import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("ledger desk explains cash, replay and correction through the real API", async ({ page }) => {
  const lesson = (await (await page.request.get("/api/v1/lesson")).json()).data;
  const post = async (path: string, key: string, data: object) =>
    (
      await (
        await page.request.post("/api/v1" + path, { headers: { "idempotency-key": key }, data })
      ).json()
    ).data;
  const mandate = await post("/mandates", "browser-book-mandate", lesson.mandate);
  const portfolio = await post("/portfolios", "browser-book-portfolio", {
    name: "Accounting walkthrough",
    mandateId: mandate.id,
  });
  const candidates = (await (await page.request.get("/api/v1/instruments/search?q=AURA")).json())
    .data.candidates;
  await post("/instruments/resolutions", "browser-book-instrument", {
    candidateId: candidates[0].candidateId,
  });
  await page.goto("/#book");
  await page.getByRole("combobox", { name: "Portfolio", exact: true }).selectOption(portfolio.id);
  await page.getByRole("button", { name: "Post event", exact: true }).click();
  await expect(page.getByTestId("settled-cash")).toHaveText("10000.00");
  await page.getByLabel("Event type").selectOption("buy");
  await page
    .getByLabel("Saved instrument")
    .selectOption({ label: "AURA · revision 1 · synthetic_verified" });
  await page.getByRole("button", { name: "Post event", exact: true }).click();
  await expect(page.getByTestId("settled-cash")).toHaveText("8995.00");
  await expect(page.getByTestId("position-quantity")).toHaveText("10.00000000");
  await page.getByRole("button", { name: "Replay last command" }).click();
  await expect(page.getByRole("status")).toContainText("No duplicate");
  await expect(page.locator(".book-event")).toHaveCount(2);
  const book = (
    await (await page.request.get("/api/v1/portfolios/" + portfolio.id + "/book")).json()
  ).data;
  await page.getByLabel("Original event").selectOption(book.events[1].id);
  await page.getByLabel("Quantity", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Reverse and replace from form" }).click();
  await expect(page.getByTestId("settled-cash")).toHaveText("9195.00");
  await expect(page.getByTestId("position-quantity")).toHaveText("8.00000000");
  await expect(page.locator(".book-event")).toHaveCount(4);
  await page.locator(".book-event").nth(1).locator("summary").click();
  await expect(page.locator(".book-event").nth(1)).toContainText("investment_cost");
  await expect(page.locator(".book-event").nth(1)).toContainText("1000.00 USD");
  await page.getByLabel("Quantity", { exact: true }).fill("1000");
  await page.getByRole("button", { name: "Post event", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Insufficient available cash");
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByTestId("settled-cash")).toHaveText("9195.00");
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-5-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/chapter-5-mobile.png", fullPage: true });
});
