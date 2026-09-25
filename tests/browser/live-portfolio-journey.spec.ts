import { expect, test } from "@playwright/test";
import { demoMandate } from "@portfolio-atlas/testing";

test("live portfolio dashboard values a held position with mark evidence", async ({ page }) => {
  const api = page.request;
  const post = async (path: string, key: string, data: object) => {
    const r = await api.post("/api/v1" + path, { headers: { "idempotency-key": key }, data });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()).data;
  };
  const mandate = await post("/mandates", "live-portfolio-mandate", demoMandate);
  const portfolio = await post("/portfolios", "live-portfolio-create", {
    name: "Live dashboard lesson",
    mandateId: mandate.id,
  });
  await post("/ledger/events", "live-portfolio-deposit", {
    portfolioId: portfolio.id,
    kind: "deposit",
    occurredAt: "2026-09-01T00:00:00Z",
    currency: "USD",
    amount: "10000",
    sourceRef: "live-portfolio-capital",
  });
  const search = (await (await api.get("/api/v1/instruments/search?q=AURA")).json()).data;
  const aura = (
    await post("/instruments/resolutions", "live-portfolio-resolve", {
      candidateId: search.candidates[0].candidateId,
    })
  ).instrument;
  await post("/ledger/events", "live-portfolio-buy", {
    portfolioId: portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: aura.instrumentId,
    instrumentRevision: aura.revision,
    quantity: "10",
    unitPrice: "100",
    fee: "0",
    occurredAt: new Date().toISOString(),
    sourceRef: "live-portfolio-buy",
  });
  await post("/live/cycles", "live-portfolio-cycle", {});

  await page.goto("/#live-portfolio");
  await expect(
    page.getByRole("heading", { name: "What is the portfolio worth right now?" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Portfolio" })
    .selectOption({ label: "Live dashboard lesson" });
  await page.getByRole("button", { name: "Value now" }).click();
  const summary = page.getByRole("region", { name: "Account summary" });
  await expect(summary).toContainText("Net asset value · complete");
  await expect(summary).toContainText("1 of 1 marked");
  const holdings = page.getByRole("region", { name: "Holdings and mark evidence" });
  const row = holdings.getByRole("row").filter({ hasText: aura.instrumentId });
  await expect(row).toContainText(/Last trade|Close/);
  await expect(row).toContainText("chapter-22.live-mark.v1");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});
