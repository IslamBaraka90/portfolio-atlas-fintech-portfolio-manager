import { test as base } from "@playwright/test";

// Browser journeys run against an API whose clock starts at ATLAS_CLOCK_START (see
// playwright.config.ts), shortly after the September 2026 synthetic fixtures. Every
// journey reads that server time instead of the runner's wall clock, and the browser
// page runs on the same time, so freshness, cutoffs and event times never drift as the
// calendar moves on. The derived clock is taken after the server answered, so it can
// lag the server by one round trip but never runs ahead of it.
export const test = base.extend<{ serverNow: () => string }>({
  serverNow: [
    async ({ page }, use) => {
      const reply = await page.request.get("/api/v1/lesson");
      const began = Date.now();
      if (!reply.ok()) throw new Error("Server clock unavailable: " + (await reply.text()));
      const start = Date.parse((await reply.json()).metadata.generatedAt);
      const now = () => new Date(start + (Date.now() - began)).toISOString();
      await page.clock.install({ time: now() });
      await use(now);
    },
    { auto: true },
  ],
});
export { expect, type Page } from "@playwright/test";
