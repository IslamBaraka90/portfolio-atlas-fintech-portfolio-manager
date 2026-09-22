import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { demoMandate } from "@portfolio-atlas/testing";
test("reporting desk approves explicit gaps and exports the same frozen revision with a printable view", async ({
  page,
}) => {
  const post = async (path: string, key: string, data: object) => {
    const r = await page.request.post("/api/v1" + path, {
      headers: { "idempotency-key": "browser-report-" + key },
      data,
    });
    expect(r.status(), await r.text()).toBe(201);
    return (await r.json()).data;
  };
  const m = await post("/mandates", "mandate", demoMandate),
    p = await post("/portfolios", "portfolio", { name: "=2+2", mandateId: m.id });
  const book = await post("/ledger/events", "opening", {
    portfolioId: p.id,
    kind: "deposit",
    currency: "USD",
    amount: "10000",
    occurredAt: new Date().toISOString(),
    sourceRef: "browser-report-opening",
  });
  const v = await post("/valuations", "value", {
    portfolioId: p.id,
    checkpoint: book.book.checkpoint,
    asOf: new Date().toISOString(),
    prices: [],
  });
  await page.goto("/#reports");
  await page.getByRole("combobox", { name: "Report portfolio", exact: true }).selectOption(p.id);
  await page.getByRole("combobox", { name: "Report valuation", exact: true }).selectOption(v.id);
  await page.getByRole("button", { name: "Generate frozen report", exact: true }).click();
  await expect(page.getByTestId("report-nav")).toContainText("10000.00 USD");
  await expect(page.getByTestId("frozen-report")).toContainText("No matching monitor selected.");
  await page
    .getByLabel("Approval reason", { exact: true })
    .fill("Review educational report with its missing evidence visible");
  await page.getByRole("button", { name: "Approve frozen report", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Explicitly acknowledge");
  await page
    .getByRole("checkbox", { name: "Acknowledge every missing section", exact: false })
    .check();
  await page.getByRole("button", { name: "Approve frozen report", exact: true }).click();
  await expect(
    page.getByTestId("frozen-report").getByText("approved", { exact: true }),
  ).toBeVisible();
  const jsonHref = await page
      .getByRole("link", { name: "Export frozen JSON", exact: true })
      .getAttribute("href"),
    csvHref = await page
      .getByRole("link", { name: "Export spreadsheet CSV", exact: true })
      .getAttribute("href");
  const json = await (await page.request.get(jsonHref!)).json(),
    csv = await (await page.request.get(csvHref!)).text();
  expect(json.revision).toBe(2);
  expect(json.navTie.nav).toBe("10000.00");
  expect(csv).toContain('"\'=2+2"');
  expect(csv).toContain('"10000.00"');
  await post("/ledger/events", "later", {
    portfolioId: p.id,
    kind: "deposit",
    currency: "USD",
    amount: "500",
    occurredAt: new Date().toISOString(),
    sourceRef: "browser-report-later",
  });
  await expect(page.getByTestId("report-nav")).toContainText("10000.00 USD");
  expect(await (await page.request.get(jsonHref!)).json()).toEqual(json);
  await page.getByRole("combobox", { name: "View report revision", exact: true }).selectOption("1");
  await expect(page.getByTestId("frozen-report").getByText("draft", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "View report revision", exact: true }).selectOption("2");
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-16-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-16-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("button", { name: "Generate frozen report", exact: true }),
  ).toBeHidden();
  await expect(page.getByTestId("report-nav")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-16-print.png", fullPage: true });
});
