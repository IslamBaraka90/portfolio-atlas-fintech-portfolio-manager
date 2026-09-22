import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { seedTrading } from "../helpers/seed-trading.js";
test("operations desk distinguishes partial custody, preserves a one-share break and records resolution evidence", async ({
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
  const seed = await seedTrading(get, post, "browser-operations", () => new Date().toISOString());
  await page.goto("/#operations");
  await page.getByLabel("UTC business weekdays (0 Sunday to 6 Saturday)").fill("0,1,2,3,4,5,6");
  await page.getByRole("button", { name: "Save calendar", exact: true }).click();
  await expect(page.getByText(/Authored UTC teaching calendar: 0 business days/)).toBeVisible();
  const calendars = await get("/settlement-policies"),
    calendar = calendars.at(-1);
  const p = await post("/rebalances", "browser-ops-plan", {
    ...seed.input,
    newPrices: seed.input.newPrices.map((p) => ({ ...p, price: "390" })),
  });
  await post("/rebalances/" + p.id + "/approval", "browser-ops-approve", { expectedRevision: 1 });
  await page.goto("/#orders");
  await page.getByRole("combobox", { name: "Execution proposal", exact: true }).selectOption(p.id);
  await page
    .getByRole("combobox", { name: "Settlement policy", exact: true })
    .selectOption(calendar.id);
  await page.getByRole("button", { name: "Submit paper batch", exact: true }).click();
  await page.getByRole("button", { name: "Broker accepts order", exact: true }).click();
  await page.getByLabel("Opening available shares").fill("10");
  await page.getByRole("button", { name: "Simulate opening event", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Order state: filled", exact: true }),
  ).toBeVisible();
  const batch = (await get("/paper-batches")).find(
      (b: { portfolioId: string }) => b.portfolioId === seed.portfolio.id,
    ),
    fill = batch.orders[0].fills[0];
  await page.goto("/#operations");
  await page
    .getByRole("combobox", { name: "Operations portfolio", exact: true })
    .selectOption(seed.portfolio.id);
  await page
    .getByRole("combobox", { name: "Pending obligation", exact: true })
    .selectOption(fill.settlementId);
  await page.getByLabel("Delivered shares", { exact: true }).fill("9");
  await page.getByLabel("Custody event reference", { exact: true }).fill("browser-custody-nine");
  await page.getByRole("button", { name: "Acknowledge delivery", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await get("/portfolios/" + seed.portfolio.id + "/book")).book.positions[0].custodyQuantity,
    )
    .toBe("9.00000000");
  const current = await get("/paper-batches/" + batch.id);
  const statement = {
    portfolioId: seed.portfolio.id,
    asOf: new Date().toISOString(),
    sourceRef: "browser-independent-custody",
    source: "synthetic_custodian_statement",
    trades: [
      {
        lineId: "line-1",
        fillId: fill.id,
        instrumentId: batch.orders[0].instrumentId,
        side: "buy",
        currency: "USD",
        quantity: "10",
        netCash: "3903.90",
        fee: "3.90",
        tradeDate: fill.at.slice(0, 10),
        valueDate: fill.dueDate,
      },
    ],
    positions: [
      { instrumentId: batch.orders[0].instrumentId, currency: "USD", settledQuantity: "10" },
    ],
    cash: [{ currency: "USD", settled: "6486.49" }],
    actions: [],
  };
  await page.getByLabel("Statement JSON", { exact: true }).fill(JSON.stringify(statement));
  await page.getByRole("button", { name: "Import synthetic statement", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Statement revision", exact: true }),
  ).not.toHaveValue("");
  await page
    .getByRole("textbox", { name: "Paper batch references JSON", exact: true })
    .fill(JSON.stringify([{ id: batch.id, revision: current.revision }]));
  await page.getByRole("button", { name: "Reconcile statement", exact: true }).click();
  const result = page.getByTestId("reconciliation-result");
  await expect(
    result.getByRole("heading", { name: "Reconciliation: breaks", exact: true }),
  ).toBeVisible();
  await expect(result).toContainText("9.00000000");
  await page
    .getByRole("combobox", { name: "Break to resolve", exact: true })
    .selectOption("break-1");
  await page.getByLabel("Evidence reference", { exact: true }).fill("custody-pending-share-case");
  await page
    .getByLabel("Resolution reason", { exact: true })
    .fill("Request confirmation for one undelivered share");
  await page.getByRole("button", { name: "Propose resolution", exact: true }).click();
  await page.getByRole("button", { name: "Approve resolution", exact: true }).click();
  await expect(page.getByText("approved_followup", { exact: true })).toBeVisible();
  await expect(
    result.getByRole("heading", { name: "Reconciliation: breaks", exact: true }),
  ).toBeVisible();
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/chapter-13-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/chapter-13-mobile.png", fullPage: true });
});
