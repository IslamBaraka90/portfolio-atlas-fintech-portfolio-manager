import { test, expect } from "../helpers/clock.js";
import { mkdir } from "node:fs/promises";
test("construction desk compares D14 methods, exposes constraint breaches and creates no orders", async ({
  page,
  serverNow,
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
  const mandate = await post("/mandates", "browser-target-mandate", lesson.mandate);
  const portfolio = await post("/portfolios", "browser-target-portfolio", {
    name: "Target walkthrough",
    mandateId: mandate.id,
  });
  await post("/ledger/events", "browser-target-capital", {
    portfolioId: portfolio.id,
    kind: "deposit",
    occurredAt: "2026-09-01T00:00:00Z",
    currency: "USD",
    amount: "10000",
    sourceRef: "construction-capital",
  });
  const valuation = await post("/valuations", "browser-target-value", {
    portfolioId: portfolio.id,
    checkpoint: 1,
    asOf: serverNow(),
    prices: [],
  });
  const runs: { id: string; revision: number }[] = [],
    ids: string[] = [];
  for (const symbol of ["AURA", "HARB"]) {
    const candidates = (
      await (await page.request.get("/api/v1/instruments/search?q=" + symbol)).json()
    ).data.candidates;
    const instrument = (
      await post("/instruments/resolutions", "browser-target-instrument-" + symbol, {
        candidateId: candidates[0].candidateId,
      })
    ).instrument;
    ids.push(instrument.instrumentId);
    const dataset = (
      await post("/market-data/ingestions", "browser-target-data-" + symbol, {
        instrumentId: instrument.instrumentId,
        instrumentRevision: instrument.revision,
        from: "2026-09-01",
        to: "2026-09-18",
        scenario: "clean",
      })
    ).dataset;
    const review = await post("/corporate-actions/reviews", "browser-target-review-" + symbol, {
      datasetId: dataset.id,
      datasetRevision: dataset.revision,
    });
    const run = await post("/adjustment-runs", "browser-target-adjust-" + symbol, {
      reviewId: review.id,
      actionKnowledgeAt: serverNow(),
      targetCurrency: "USD",
    });
    runs.push({ id: run.id, revision: run.revision });
  }
  const risk = await post("/risk-models", "browser-target-risk", {
    adjustmentRuns: runs,
    asOf: serverNow(),
    estimator: "ledoit_wolf",
    expectedReturnAssumption: "scenario",
    annualExpectedReturns: ids.map((instrumentId) => ({ instrumentId, annualReturn: 0.05 })),
  });
  await page.goto("/#construction");
  await page
    .getByRole("combobox", { name: "Construction portfolio", exact: true })
    .selectOption(portfolio.id);
  await page
    .getByRole("combobox", { name: "Current valuation snapshot", exact: true })
    .selectOption(valuation.id);
  await page
    .getByRole("combobox", { name: "Construction risk model", exact: true })
    .selectOption(risk.id);
  await page.getByRole("button", { name: "Compare construction methods", exact: true }).click();
  const result = page.getByTestId("target-result");
  await expect(
    result.getByRole("heading", { name: "Target: proposal", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Inspect minimum_variance", exact: true }),
  ).toBeVisible();
  const proposalId = await page
    .getByRole("combobox", { name: "Saved target snapshot", exact: true })
    .inputValue();
  await expect(result.getByRole("button", { name: "Send orders", exact: true })).toBeDisabled();
  await page.getByLabel("Volatility stress factor").fill("2");
  await page.getByRole("button", { name: "Compare stressed inputs" }).click();
  await expect(result).toContainText("covariance volatility stress 2×");
  await page.getByLabel("Estimated cost (bps)").fill("1000");
  await page.getByRole("button", { name: "Create target proposal", exact: true }).click();
  await expect(
    result.getByRole("heading", { name: "Target: candidate_rejected", exact: true }),
  ).toBeVisible();
  await expect(result.getByRole("row").filter({ hasText: "ESTIMATED_COST" })).toContainText("fail");
  await page.getByLabel("Fixed cash fraction").fill("0");
  await page.getByRole("button", { name: "Create target proposal", exact: true }).click();
  await expect(
    result.getByRole("heading", { name: "Target: infeasible", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Saved target snapshot", exact: true })
    .selectOption(proposalId);
  await expect(
    result.getByRole("heading", { name: "Target: proposal", exact: true }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/v1/portfolios/" + portfolio.id + "/book")).json()).data
      .book.checkpoint,
  ).toBe(1);
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-9-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-9-mobile.png", fullPage: true });
});
