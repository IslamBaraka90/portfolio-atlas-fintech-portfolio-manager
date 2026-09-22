import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("risk explorer shows perfect dependence and compares shrinkage on the exact frozen sample", async ({
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
  const selected: { symbol: string; revision: number }[] = [];
  for (const symbol of ["AURA", "HARB"]) {
    const candidates = (
      await (await page.request.get("/api/v1/instruments/search?q=" + symbol)).json()
    ).data.candidates;
    const instrument = (
      await post("/instruments/resolutions", "browser-risk-instrument-" + symbol, {
        candidateId: candidates[0].candidateId,
      })
    ).instrument;
    const dataset = (
      await post("/market-data/ingestions", "browser-risk-data-" + symbol, {
        instrumentId: instrument.instrumentId,
        instrumentRevision: instrument.revision,
        from: "2026-09-01",
        to: "2026-09-18",
        scenario: "clean",
      })
    ).dataset;
    const review = await post("/corporate-actions/reviews", "browser-risk-review-" + symbol, {
      datasetId: dataset.id,
      datasetRevision: dataset.revision,
    });
    const run = await post("/adjustment-runs", "browser-risk-adjust-" + symbol, {
      reviewId: review.id,
      actionKnowledgeAt: new Date().toISOString(),
      targetCurrency: "USD",
    });
    selected.push({ symbol, revision: run.revision });
  }
  await page.goto("/#risk");
  for (const item of selected)
    await page
      .getByRole("checkbox", {
        name: item.symbol + " · clean · adjustment r" + item.revision + " · ready",
        exact: true,
      })
      .check();
  await page.getByLabel("Expected-return assumption").selectOption("scenario");
  await page.getByLabel("Annual return assumption for AURA", { exact: true }).fill("0.08");
  await page.getByLabel("Annual return assumption for HARB", { exact: true }).fill("0.04");
  await page.getByRole("button", { name: "Freeze risk model", exact: true }).click();
  const result = page.getByTestId("risk-result");
  await expect(
    result.getByRole("heading", { name: "Risk model: ready", exact: true }),
  ).toBeVisible();
  await expect(result).toContainText("Rank: 1 / 2");
  await expect(result).toContainText("Positive definite: no");
  await expect(result.getByRole("cell", { name: "8.00%", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Compare ledoit_wolf", exact: true }).click();
  await expect(page.getByTestId("risk-comparison")).toContainText("ready · rank 2");
  await result.getByText("Provenance and limitations", { exact: true }).click();
  await expect(result).toContainText(
    "Current research history is not point-in-time strategy evidence.",
  );
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-8-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-8-mobile.png", fullPage: true });
});
