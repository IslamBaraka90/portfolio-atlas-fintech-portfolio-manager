import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("valuation desk freezes NAV, exposes stale evidence and rejects benchmark basis mismatch", async ({
  page,
}) => {
  const post = async (path: string, key: string, data: object) => {
    const reply = await page.request.post("/api/v1" + path, {
      headers: { "idempotency-key": key },
      data,
    });
    expect(reply.status()).toBe(201);
    return (await reply.json()).data;
  };
  const lesson = (await (await page.request.get("/api/v1/lesson")).json()).data;
  const mandate = await post("/mandates", "browser-value-mandate", lesson.mandate);
  const portfolio = await post("/portfolios", "browser-value-portfolio", {
    name: "NAV walkthrough",
    mandateId: mandate.id,
  });
  const candidates = (await (await page.request.get("/api/v1/instruments/search?q=AURA")).json())
    .data.candidates;
  const instrument = (
    await post("/instruments/resolutions", "browser-value-instrument", {
      candidateId: candidates[0].candidateId,
    })
  ).instrument;
  const base = { portfolioId: portfolio.id, currency: "USD", occurredAt: "2026-09-01T00:00:00Z" };
  await post("/ledger/events", "browser-value-deposit", {
    ...base,
    kind: "deposit",
    amount: "10000",
    sourceRef: "deposit-one",
  });
  await post("/ledger/events", "browser-value-buy", {
    ...base,
    kind: "buy",
    quantity: "10",
    unitPrice: "100",
    fee: "5",
    instrumentId: instrument.instrumentId,
    instrumentRevision: instrument.revision,
    sourceRef: "buy-one",
  });
  const dataset = (
    await post("/market-data/ingestions", "browser-value-data", {
      instrumentId: instrument.instrumentId,
      instrumentRevision: instrument.revision,
      from: "2026-09-01",
      to: "2026-09-18",
      scenario: "clean",
    })
  ).dataset;
  const review = await post("/corporate-actions/reviews", "browser-value-review", {
    datasetId: dataset.id,
    datasetRevision: dataset.revision,
  });
  const adjustment = await post("/adjustment-runs", "browser-value-adjustment", {
    reviewId: review.id,
    actionKnowledgeAt: new Date().toISOString(),
    targetCurrency: "EUR",
  });
  await page.goto("/#valuation");
  await page
    .getByRole("combobox", { name: "Valuation portfolio", exact: true })
    .selectOption(portfolio.id);
  await page.getByLabel("Price dataset for " + instrument.instrumentId).selectOption(dataset.id);
  await page
    .getByLabel("Price row for " + instrument.instrumentId)
    .selectOption(dataset.rows.find((r: { close: number }) => r.close === 110).rowId);
  // Fixture prices are dated September 2026 while the browser server runs on the real
  // clock; the widest allowed age (30 days) keeps the fixture row fresh for longer.
  await page.getByLabel("Maximum price age (calendar days)").fill("30");
  await page.getByRole("button", { name: "Freeze valuation", exact: true }).click();
  await expect(page.getByTestId("nav-value")).toHaveText("10095.00");
  await expect(page.getByText("USD net contributions:", { exact: false })).toContainText(
    "10000.00",
  );
  await page.getByLabel("Maximum price age (calendar days)").fill("1");
  await page.getByRole("button", { name: "Freeze valuation", exact: true }).click();
  await expect(page.getByTestId("nav-value")).toHaveText("Incomplete");
  await expect(page.getByRole("table").filter({ hasText: "Price is stale" })).toBeVisible();
  await page.getByLabel("Maximum price age (calendar days)").fill("30");
  await post("/ledger/events", "browser-value-extra-capital", {
    ...base,
    kind: "deposit",
    amount: "500",
    sourceRef: "deposit-two",
  });
  await page.getByRole("button", { name: "Refresh book checkpoint" }).click();
  await expect(page.getByText(/Book checkpoint 3/)).toBeVisible();
  await page.getByRole("button", { name: "Freeze valuation", exact: true }).click();
  await expect(page.getByTestId("nav-value")).toHaveText("10595.00");
  await page
    .getByRole("listbox", { name: "Benchmark constituent histories" })
    .selectOption(adjustment.id);
  await page.getByRole("button", { name: "Freeze benchmark and calculate" }).click();
  await expect(page.getByRole("heading", { name: "Benchmark: ready", exact: true })).toBeVisible();
  await expect(page.getByText("Comparison: incompatible", { exact: true })).toBeVisible();
  await page.getByLabel("Requested portfolio return convention").selectOption("price");
  await expect(page.getByText("Comparison: compatible", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Frozen benchmark level history" })).toBeVisible();
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-6-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/chapter-6-mobile.png", fullPage: true });
});
