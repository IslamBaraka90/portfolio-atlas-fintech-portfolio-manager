import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { seedTrading } from "../helpers/seed-trading.js";
test("risk desk shows independent shock arithmetic, deduplicated alerts and stale-resolution refusal", async ({
  page,
}) => {
  const get = async (path: string) =>
    (await (await page.request.get("/api/v1" + path)).json()).data;
  const post = async (path: string, key: string, data: object) => {
    const r = await page.request.post("/api/v1" + path, {
      headers: { "idempotency-key": key },
      data,
    });
    expect(r.status(), await r.text()).toBe(201);
    return (await r.json()).data;
  };
  const seed = await seedTrading(get, post, "browser-monitor", () => new Date().toISOString());
  const book = await post("/ledger/events", "browser-monitor-buy", {
    portfolioId: seed.portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: seed.instruments[0]!.instrumentId,
    instrumentRevision: seed.instruments[0]!.revision,
    quantity: "10",
    unitPrice: "100",
    fee: "0",
    occurredAt: new Date().toISOString(),
    sourceRef: "browser-monitor-buy",
  });
  const v = await post("/valuations", "browser-monitor-value", {
    portfolioId: seed.portfolio.id,
    checkpoint: book.book.checkpoint,
    asOf: new Date().toISOString(),
    prices: [],
    overrides: [{ ...seed.input.newPrices[0], quotedAt: new Date().toISOString() }],
  });
  await page.goto("/#monitoring");
  await page
    .getByRole("combobox", { name: "Monitoring valuation", exact: true })
    .selectOption(v.id);
  await page
    .getByRole("combobox", { name: "Historical risk model", exact: true })
    .selectOption(seed.risk.id);
  await page
    .getByRole("combobox", { name: "Comparison target", exact: true })
    .selectOption(seed.target.id);
  await page.getByRole("button", { name: "Run risk monitor", exact: true }).click();
  await expect(page.getByTestId("scenario-total")).toContainText("-100.00");
  await expect(
    page.getByRole("img", { name: "Sorted historical losses and 95 percent VaR" }),
  ).toBeVisible();
  const findings = (await get("/risk-findings")).filter(
      (f: { portfolioId: string }) => f.portfolioId === seed.portfolio.id,
    ),
    cash = findings.find((f: { rule: string }) => f.rule === "cash_ceiling");
  await page.getByRole("combobox", { name: "Risk finding", exact: true }).selectOption(cash.id);
  await page
    .getByLabel("Review reason", { exact: true })
    .fill("Review excess cash after the initial purchase");
  await page.getByRole("button", { name: "Acknowledge finding", exact: true }).click();
  await expect(page.getByTestId("finding-detail")).toContainText("Finding: acknowledged");
  await page.getByRole("button", { name: "Run risk monitor", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await get("/risk-findings")).filter(
          (f: { portfolioId: string }) => f.portfolioId === seed.portfolio.id,
        ).length,
    )
    .toBe(findings.length);
  await post("/ledger/events", "browser-monitor-new-cash", {
    portfolioId: seed.portfolio.id,
    kind: "deposit",
    currency: "USD",
    amount: "1",
    occurredAt: new Date().toISOString(),
    sourceRef: "browser-monitor-new-cash",
  });
  await page.getByRole("button", { name: "Run risk monitor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Evidence: unavailable", exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Risk finding", exact: true }).selectOption(cash.id);
  await page.getByRole("button", { name: "Resolve finding", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("fresh passing observation");
  await expect(page.getByTestId("finding-detail")).toContainText("Finding: acknowledged");
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-14-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-14-mobile.png", fullPage: true });
});
