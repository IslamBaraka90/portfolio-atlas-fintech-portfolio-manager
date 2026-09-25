import assert from "node:assert/strict";
import test from "node:test";
import { demoMandate } from "@portfolio-atlas/testing";
import { buildApp } from "../src/app.js";

test("live risk is assessed once per valuation and the monitor keeps one finding per breach", async (t) => {
  let now = "2026-09-24T15:07:30.000Z";
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
  const mandate = await post("/mandates", "risk-mandate-key", demoMandate);
  const portfolio = await post("/portfolios", "risk-portfolio-key", {
    name: "Live risk lesson",
    mandateId: mandate.id,
  });
  await post("/ledger/events", "risk-deposit-key", {
    portfolioId: portfolio.id,
    kind: "deposit",
    occurredAt: "2026-09-01T00:00:00Z",
    currency: "USD",
    amount: "10000",
    sourceRef: "risk-capital",
  });
  const search = await get("/instruments/search?q=AURA");
  const aura = (
    await post("/instruments/resolutions", "risk-resolve-key", {
      candidateId: search.candidates[0].candidateId,
    })
  ).instrument;
  await post("/ledger/events", "risk-buy-key", {
    portfolioId: portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: aura.instrumentId,
    instrumentRevision: aura.revision,
    quantity: "10",
    unitPrice: "100",
    fee: "0",
    occurredAt: now,
    sourceRef: "risk-buy",
  });

  const first = await post("/live/cycles", "risk-cycle-1");
  const riskTask = first.tasks.find((x: { name: string }) => x.name === "risk");
  assert.match(riskTask.detail, /^1 new risk assessment/);
  const risk = await get("/portfolios/" + portfolio.id + "/live-risk");
  assert.equal(risk.policy, "chapter-23.live-risk.v1");
  assert.equal(risk.benchmark, "ATLS");
  assert.equal(risk.status, "complete");
  assert.equal(risk.window.returns, 60, "a full 60-return window from the daily backfill");
  assert.ok(risk.holdings[0].ewmaVolatility > 0);
  assert.ok(Number.isFinite(risk.portfolio.beta));
  assert.ok(Number.isFinite(risk.portfolio.trackingError));
  assert.equal(risk.portfolio.maxDrawdown, null, "one NAV point is not a drawdown");
  // About 89% cash breaches the demo mandate's cash ceiling.
  assert.ok(risk.monitor.id);
  assert.ok(risk.monitor.breaches >= 1);
  const findings = (await get("/risk-findings")).length;

  // Same valuation again: no new assessment.
  const second = await post("/live/cycles", "risk-cycle-2");
  assert.match(
    second.tasks.find((x: { name: string }) => x.name === "risk").detail,
    /^0 new risk assessment/,
  );
  // A minute later: a new valuation and assessment, and the breach updates the same finding.
  now = "2026-09-24T15:08:30.000Z";
  await post("/live/cycles", "risk-cycle-3");
  const later = await get("/portfolios/" + portfolio.id + "/live-risk");
  assert.notEqual(later.valuationId, risk.valuationId);
  assert.equal((await get("/risk-findings")).length, findings, "no duplicate findings");
});
