import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("a lost portfolio response is safely replayed without creating another portfolio", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create learning portfolio" })).toBeEnabled();
  const before = (await (await page.request.get("/api/v1/portfolios")).json()).data.length;
  await page.route(
    "**/api/v1/portfolios",
    async (route) => {
      // The server commits successfully; simulate losing the response on the wire.
      await route.fetch();
      await route.abort();
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Create learning portfolio" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Mandate saved; portfolio pending", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save mandate revision" }).click();
  await expect(page.getByRole("button", { name: "Check allocation" })).toBeEnabled();
  await expect(page.getByText("REV 1", { exact: true })).toBeVisible();
  const after = (await (await page.request.get("/api/v1/portfolios")).json()).data.length;
  expect(after).toBe(before + 1);
});

test("a concurrent mandate edit returns a visible conflict and reload recovers", async ({
  page,
}) => {
  await createPortfolio(page);
  const portfolioId = await page.getByLabel("Open saved portfolio").inputValue();
  const portfolio = (await (await page.request.get("/api/v1/portfolios/" + portfolioId)).json())
    .data;
  const lesson = (await (await page.request.get("/api/v1/lesson")).json()).data;
  const edited = await page.request.put("/api/v1/mandates/" + portfolio.mandateId, {
    headers: { "idempotency-key": "concurrent-" + portfolioId },
    data: { expectedRevision: 1, mandate: { ...lesson.mandate, maxPositionWeight: 0.5 } },
  });
  expect(edited.status()).toBe(200);
  await page.getByRole("button", { name: "Check allocation" }).click();
  await expect(page.getByRole("alert")).toContainText("The mandate changed");
  await page.getByRole("button", { name: "Reload session" }).click();
  await page.getByLabel("Open saved portfolio").selectOption(portfolioId);
  await expect(page.getByText("REV 2", { exact: true })).toBeVisible();
  await scenario(page, "Balanced", "The allocation meets this mandate.");
});

async function createPortfolio(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create learning portfolio" })).toBeEnabled();
  await page.getByRole("button", { name: "Create learning portfolio" }).click();
  await expect(page.getByRole("button", { name: "Check allocation" })).toBeEnabled();
}
async function scenario(page: Page, name: string, result: string) {
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Check allocation" }).click();
  await expect(page.getByRole("heading", { name: result, exact: true })).toBeVisible();
}
test("connected allocation journey explains each distinct outcome and saves a revision", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await createPortfolio(page);
  await scenario(page, "Concentrated", "A limit needs your attention.");
  const capRow = page
    .getByRole("row")
    .filter({ hasText: "Position cap" })
    .filter({ hasText: "DEMO-AURORA" });
  await expect(capRow).toContainText("60%");
  await expect(capRow).toContainText("≤ 40%");
  await expect(capRow).toContainText("Fail");
  await scenario(page, "Balanced", "The allocation meets this mandate.");
  await scenario(page, "Low cash", "A limit needs your attention.");
  await expect(page.getByRole("row").filter({ hasText: "Cash floor" })).toContainText("5%");
  await scenario(page, "Missing sector", "More information is needed.");
  await scenario(page, "110% total", "Fix the allocation or policy first.");
  await page.getByLabel("Cash minimum", { exact: true }).fill("35");
  await page.getByRole("button", { name: "Save mandate revision" }).click();
  await expect(page.getByText("REV 2", { exact: true })).toBeVisible();
  await scenario(page, "Balanced", "Fix the allocation or policy first.");
  await expect(page.getByRole("table")).toContainText("Minimum cash exceeds maximum cash.");
  await page.getByLabel("Cash minimum", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save mandate revision" }).click();
  await expect(page.getByText("REV 3", { exact: true })).toBeVisible();
  await scenario(page, "Balanced", "The allocation meets this mandate.");
  await page.getByText("Inspect evaluation provenance").click();
  await expect(page.getByText("chapter-1.v1", { exact: true })).toBeVisible();
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/chapter-1-desktop.png", fullPage: true });
  const savedPortfolioId = await page.getByLabel("Open saved portfolio").inputValue();
  await page.reload();
  await page.getByLabel("Open saved portfolio").selectOption(savedPortfolioId);
  await expect(page.getByText("REV 3", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("failed requests focus an accessible error and can be retried", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Create learning portfolio" })).toBeEnabled();
  await page.route("**/api/v1/mandates", (route) => route.abort(), { times: 1 });
  await page.getByRole("button", { name: "Create learning portfolio" }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByRole("alert")).toContainText("API is unavailable");
  await page.getByRole("button", { name: "Create learning portfolio" }).click();
  await expect(page.getByRole("button", { name: "Check allocation" })).toBeEnabled();
});
test("mobile layout stays inside the viewport and supports an unknown sector", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createPortfolio(page);
  await scenario(page, "Missing sector", "More information is needed.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "artifacts/chapter-1-mobile.png", fullPage: true });
});
test("loading, keyboard navigation and a changed server session are visible", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("atlas-session", "previous-process"));
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/lesson", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await expect(page.getByText("Connecting to your local API…", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to learning desk" })).toBeFocused();
  release();
  await expect(page.getByRole("status")).toContainText("previous session was cleared");
});
