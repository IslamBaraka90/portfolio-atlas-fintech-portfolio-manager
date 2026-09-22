import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { demoMandate } from "@portfolio-atlas/testing";
test("performance desk removes a cash deposit from return and reconciles the authored sector waterfall", async ({
  page,
}) => {
  const post = async (path: string, key: string, data: object) => {
    const r = await page.request.post("/api/v1" + path, {
      headers: { "idempotency-key": "browser-perf-" + key },
      data,
    });
    expect(r.status(), await r.text()).toBe(201);
    return (await r.json()).data;
  };
  const m = await post("/mandates", "mandate", demoMandate),
    p = await post("/portfolios", "portfolio", {
      name: "Browser performance lesson",
      mandateId: m.id,
    });
  let book = await post("/ledger/events", "opening", {
    portfolioId: p.id,
    kind: "deposit",
    currency: "USD",
    amount: "10095",
    occurredAt: new Date().toISOString(),
    sourceRef: "browser-perf-opening",
  });
  const a = await post("/valuations", "first", {
    portfolioId: p.id,
    checkpoint: book.book.checkpoint,
    asOf: new Date().toISOString(),
    prices: [],
  });
  book = await post("/ledger/events", "flow", {
    portfolioId: p.id,
    kind: "deposit",
    currency: "USD",
    amount: "500",
    occurredAt: new Date().toISOString(),
    sourceRef: "browser-perf-flow",
  });
  const b = await post("/valuations", "second", {
    portfolioId: p.id,
    checkpoint: book.book.checkpoint,
    asOf: new Date().toISOString(),
    prices: [],
  });
  await page.goto("/#performance");
  await page
    .getByRole("combobox", { name: "Performance portfolio", exact: true })
    .selectOption(p.id);
  await page.getByRole("checkbox", { name: "Include valuation " + a.id, exact: true }).check();
  await page.getByRole("checkbox", { name: "Include valuation " + b.id, exact: true }).check();
  await page.getByRole("button", { name: "Measure performance", exact: true }).click();
  const result = page.getByTestId("performance-result");
  await expect(
    result.getByRole("heading", { name: "Net period TWR: 0.0000%", exact: true }),
  ).toBeVisible();
  await expect(result).toContainText("Investment profit: 0.00 USD");
  await expect(result).toContainText("500.00");
  await expect(
    page.getByRole("img", { name: "Flow-adjusted wealth index with external-flow markers" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Calculate attribution", exact: true }).click();
  const attribution = page.getByTestId("attribution-result");
  await expect(
    attribution.getByRole("heading", { name: "Active return: 1.3000%", exact: true }),
  ).toBeVisible();
  await expect(attribution).toContainText("standalone_example");
  await expect(attribution).toContainText("residual 0.0000%");
  await expect(page.getByRole("img", { name: "Attribution effects waterfall" })).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Check against selected performance", exact: false })
    .check();
  await page.getByRole("button", { name: "Calculate attribution", exact: true }).click();
  await expect(attribution).toContainText("incompatible");
  await expect(attribution).toContainText("does not equal linked net TWR");
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-15-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-15-mobile.png", fullPage: true });
});
