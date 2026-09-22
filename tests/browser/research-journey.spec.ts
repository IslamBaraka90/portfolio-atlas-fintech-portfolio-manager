import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
test("research desk shows timestamps, statement revisions and historical evidence failure", async ({
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
  const candidates = (await (await page.request.get("/api/v1/instruments/search?q=AURA")).json())
    .data.candidates;
  const instrument = (
    await post("/instruments/resolutions", "browser-research-instrument", {
      candidateId: candidates[0].candidateId,
    })
  ).instrument;
  const dataset = (
    await post("/market-data/ingestions", "browser-research-data", {
      instrumentId: instrument.instrumentId,
      instrumentRevision: instrument.revision,
      from: "2026-09-01",
      to: "2026-09-18",
      scenario: "clean",
    })
  ).dataset;
  await page.goto("/#research");
  await page.getByLabel("Company listing").selectOption(dataset.id + ":" + dataset.revision);
  await page.getByLabel("Company lesson").selectOption("late-revision");
  await page.getByRole("button", { name: "Capture company statements" }).click();
  await expect(page.getByRole("status")).toContainText("company observation snapshots");
  await page
    .getByRole("checkbox", {
      name: new RegExp("AURA · clean · revision " + dataset.revision + "$"),
    })
    .check();
  await page.getByLabel("Research cutoff (UTC)").fill(new Date().toISOString());
  await page.getByRole("button", { name: "Calculate research observations" }).click();
  const result = page.getByTestId("research-result");
  await expect(result).toContainText("12.50%");
  await expect(result).toContainText("2.50 percentage points");
  await expect(result).toContainText("Net advances: 1");
  await result.getByText("Trend rows and original timestamps").click();
  await expect(result.getByRole("cell", { name: "warmup", exact: true })).toHaveCount(2);
  await expect(result.getByRole("button", { name: "Create recommendation" })).toBeDisabled();
  await page.getByLabel("Research purpose").selectOption("historical_strategy");
  await page.getByRole("button", { name: "Calculate research observations" }).click();
  await expect(result).toContainText(
    "Current reconstructed prices do not establish point-in-time availability.",
  );
  await expect(result).toContainText("Research observations create no orders.");
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-7-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-7-mobile.png", fullPage: true });
});
