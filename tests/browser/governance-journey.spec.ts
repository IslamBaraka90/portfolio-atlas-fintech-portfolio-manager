import { test, expect } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../../apps/api/src/app.js";
import { demoMandate } from "@portfolio-atlas/testing";
test("governance desk enforces two actors, records approval and restores a real durable checkpoint", async ({
  page,
  request,
}) => {
  const directory = mkdtempSync(join(tmpdir(), "portfolio-atlas-browser-governance-"));
  const authorToken = randomBytes(32).toString("base64url"),
    reviewerToken = randomBytes(32).toString("base64url");
  const app = buildApp({
    databasePath: join(directory, "book.sqlite"),
    allowedOrigin: "http://127.0.0.1:5174",
    accessConfig: {
      scopeId: "browser-course",
      policyRevision: "chapter-17.browser.v1",
      validFrom: "2020-01-01T00:00:00Z",
      validTo: "2030-01-01T00:00:00Z",
      actors: [
        {
          id: "author",
          name: "Decision author",
          scopeId: "browser-course",
          roles: ["analyst", "operator", "approver"],
          tokenHash: createHash("sha256").update(authorToken).digest("hex"),
          validFrom: "2020-01-01T00:00:00Z",
          validTo: "2030-01-01T00:00:00Z",
        },
        {
          id: "reviewer",
          name: "Independent reviewer",
          scopeId: "browser-course",
          roles: ["approver", "reader"],
          tokenHash: createHash("sha256").update(reviewerToken).digest("hex"),
          validFrom: "2020-01-01T00:00:00Z",
          validTo: "2030-01-01T00:00:00Z",
        },
      ],
    },
  });
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  try {
    const post = async (path: string, payload: object) => {
      const response = await request.post(origin + "/api/v1" + path, {
        data: payload,
        headers: {
          authorization: "Bearer " + authorToken,
          "idempotency-key": randomBytes(12).toString("hex"),
        },
      });
      expect(response.status(), await response.text()).toBe(201);
      return (await response.json()).data;
    };
    const mandate = await post("/mandates", demoMandate);
    const portfolio = await post("/portfolios", {
      name: "Governed browser book",
      mandateId: mandate.id,
    });
    const book = await post("/ledger/events", {
      portfolioId: portfolio.id,
      kind: "deposit",
      amount: "10000",
      currency: "USD",
      occurredAt: new Date().toISOString(),
      sourceRef: "governed-opening",
    });
    const value = await post("/valuations", {
      portfolioId: portfolio.id,
      checkpoint: book.book.checkpoint,
      asOf: new Date().toISOString(),
      prices: [],
      overrides: [],
    });
    const report = await post("/reports", {
      portfolioId: portfolio.id,
      title: "Governed review report",
      asOf: value.request.asOf,
      dataCutoff: new Date().toISOString(),
      valuation: { id: value.id, revision: 1 },
    });
    // Route the real browser through a dedicated real HTTP server; other chapter fixtures stay isolated.
    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: origin + url.pathname + url.search });
      await route.fulfill({ response });
    });
    await page.goto("/#governance");
    await expect(
      page.getByText("Sign in to the configured workspace", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Provisioned access token").fill(authorToken);
    await page.getByRole("button", { name: "Start workspace session" }).click();
    await expect(page.getByText("Authenticated workspace session", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Inspect report" }).click();
    await expect(page.getByRole("button", { name: "Approve reviewed decision" })).toBeDisabled();
    const self = await request.post(origin + "/api/v1/reports/" + report.id + "/approval", {
      data: {
        expectedRevision: 1,
        actor: "Fake reviewer",
        reason: "Attempt direct self approval.",
        acknowledgeExceptions: true,
      },
      headers: {
        authorization: "Bearer " + authorToken,
        "idempotency-key": "browser-self-approval",
      },
    });
    expect(self.status()).toBe(403);
    await page.getByRole("button", { name: "End session" }).click();
    await page.getByLabel("Provisioned access token").fill(reviewerToken);
    await page.getByRole("button", { name: "Start workspace session" }).click();
    await page.getByRole("button", { name: "Inspect report" }).click();
    await page
      .getByLabel("Review reason", { exact: true })
      .fill("Reviewed the frozen report and all missing evidence sections.");
    await page.getByLabel("I acknowledge missing sections and exceptions in this report").check();
    await page.getByRole("button", { name: "Approve reviewed decision" }).click();
    await expect(page.getByText("No drafts currently await approval.")).toBeVisible();
    await page.getByLabel("Filter audit by actor, operation or resource").fill("report.approve");
    await expect(page.getByRole("cell", { name: /report.approve/ })).toBeVisible();
    await page
      .getByRole("textbox", { name: "Recovery reason", exact: true })
      .fill("Verify recovery of the governed book and issued report.");
    await page.getByRole("button", { name: "Create protected backup" }).click();
    await expect(page.getByRole("button", { name: "Verify isolated restore" })).toBeEnabled();
    await page.getByRole("button", { name: "Verify isolated restore" }).click();
    await expect(page.getByRole("heading", { name: "Restore verified" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    const cookies = await page.context().cookies();
    expect(
      cookies.some((c) => c.name === "atlas_session" && c.httpOnly && c.sameSite === "Strict"),
    ).toBeTruthy();
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: "artifacts/chapter-17-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "artifacts/chapter-17-mobile.png", fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    const approved = await request.get(origin + "/api/v1/reports/" + report.id, {
      headers: { authorization: "Bearer " + reviewerToken },
    });
    expect((await approved.json()).data.approval.actor).toBe("Independent reviewer");
  } finally {
    await page.unroute("**/api/v1/**").catch(() => {});
    await app.close();
    const target = resolve(directory),
      root = resolve(tmpdir()) + sep;
    if (
      !target.startsWith(root) ||
      !target.slice(root.length).startsWith("portfolio-atlas-browser-governance-")
    )
      throw new Error("Unsafe temporary cleanup path.");
    rmSync(target, { recursive: true, force: true });
  }
});
