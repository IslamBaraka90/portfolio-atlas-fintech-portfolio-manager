import assert from "node:assert/strict";
import test from "node:test";
import { demoMandate } from "@portfolio-atlas/testing";
import { buildApp } from "../src/app.js";

test("live performance links session closes and freezes one end-of-day report", async (t) => {
  let now = "2026-09-23T15:07:30.000Z"; // Wednesday, New York open
  const app = buildApp({ clock: { now: () => now } });
  t.after(() => app.close());
  const get = async (path: string) => (await app.inject("/api/v1" + path)).json().data;
  const post = async (path: string, key: string, payload: object = {}) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      headers: { "idempotency-key": key },
      payload,
    });
    assert.ok(r.statusCode < 300, r.body);
    return r.json().data;
  };
  const mandate = await post("/mandates", "perf-mandate-key", demoMandate);
  const portfolio = await post("/portfolios", "perf-portfolio-key", {
    name: "Live performance lesson",
    mandateId: mandate.id,
  });
  await post("/ledger/events", "perf-deposit-key", {
    portfolioId: portfolio.id,
    kind: "deposit",
    occurredAt: "2026-09-01T00:00:00Z",
    currency: "USD",
    amount: "10000",
    sourceRef: "perf-capital",
  });
  const search = await get("/instruments/search?q=AURA");
  const aura = (
    await post("/instruments/resolutions", "perf-resolve-key", {
      candidateId: search.candidates[0].candidateId,
    })
  ).instrument;
  await post("/ledger/events", "perf-buy-key", {
    portfolioId: portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: aura.instrumentId,
    instrumentRevision: aura.revision,
    quantity: "50",
    unitPrice: "100",
    fee: "0",
    occurredAt: now,
    sourceRef: "perf-buy",
  });
  await post("/live/cycles", "perf-cycle-wed");
  let perf = await get("/portfolios/" + portfolio.id + "/live-performance");
  assert.equal(perf.twr, null);
  assert.match(perf.reasons.join(" "), /at least two session dates/);

  now = "2026-09-24T15:07:30.000Z"; // Thursday open
  await post("/live/cycles", "perf-cycle-thu");
  perf = await get("/portfolios/" + portfolio.id + "/live-performance");
  assert.deepEqual(perf.sessions, ["2026-09-23", "2026-09-24"]);
  const nav = (await get("/portfolios/" + portfolio.id + "/live-nav")).points;
  // Independent arithmetic: no external flows between the two points.
  const expected = Number(nav.at(-1).nav) / Number(nav[0].nav) - 1;
  assert.ok(Math.abs(perf.twr - expected) < 1e-9, perf.reasons.join(" "));
  assert.ok(perf.performanceId);
  assert.equal(typeof perf.benchmarkReturn, "number");
  assert.ok(Math.abs(perf.activeReturn - (perf.twr - perf.benchmarkReturn)) < 1e-12);
  assert.equal(perf.reportId, null);

  // After Thursday's close plus grace, one end-of-day report is frozen.
  now = "2026-09-24T20:16:00.000Z";
  const cycle = await post("/live/cycles", "perf-cycle-close");
  assert.equal(cycle.coversSession, "2026-09-24");
  perf = await get("/portfolios/" + portfolio.id + "/live-performance");
  assert.equal(perf.reportSession, "2026-09-24");
  const report = await get("/reports/" + perf.reportId);
  assert.equal(report.request.title, "End of day 2026-09-24");
  // A second cycle for the same session does not create another report.
  await post("/live/cycles", "perf-cycle-close-2");
  const again = await get("/portfolios/" + portfolio.id + "/live-performance");
  assert.equal(again.reportId, perf.reportId);
});
