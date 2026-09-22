import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
import { seedTrading } from "../../../tests/helpers/seed-trading.js";
test("risk monitoring ties shocks and deduplicated lifecycle to fresh book evidence", async (t) => {
  let now = fixtureTime;
  const app = buildApp({ clock: { now: () => now } });
  t.after(() => app.close());
  const get = async (path: string) => (await app.inject("/api/v1" + path)).json().data;
  const post = async (path: string, key: string, payload: object) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      headers: { "idempotency-key": key },
      payload,
    });
    assert.equal(r.statusCode, 201, r.body);
    return r.json().data;
  };
  const seed = await seedTrading(get, post, "monitor", () => now);
  const trade = {
    portfolioId: seed.portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: seed.instruments[0]!.instrumentId,
    instrumentRevision: 1,
    quantity: "10",
    unitPrice: "100",
    fee: "0",
    occurredAt: now,
    sourceRef: "monitor-buy",
  };
  let book = await post("/ledger/events", "monitor-buy", trade);
  const value = async (key: string) =>
    post("/valuations", key, {
      portfolioId: seed.portfolio.id,
      checkpoint: book.book.checkpoint,
      asOf: now,
      prices: [],
      overrides: [{ ...seed.input.newPrices[0], quotedAt: now }],
    });
  let v = await value("monitor-value");
  const request = {
    valuation: { id: v.id, revision: 1 },
    riskModel: { id: seed.risk.id, revision: 1 },
    target: { id: seed.target.id, revision: 1 },
    shock: -0.1,
  };
  const first = await post("/monitors", "monitor-first", request);
  assert.equal(first.scenario[0].baseValue, "1000.00");
  assert.equal(first.scenario[0].change, "-100.00");
  assert.equal(first.scenarioTotal, "-100.00");
  assert.equal(first.history.status, "available");
  assert.equal(first.history.confidence, 0.95);
  assert.equal(first.proposedScenarioTotal, "-800.00");
  let cash = (await get("/risk-findings")).find((f: { rule: string }) => f.rule === "cash_ceiling");
  assert.equal(cash.observation.status, "breach");
  const count = (await get("/risk-findings")).length;
  await post("/monitors", "monitor-repeat", request);
  assert.equal((await get("/risk-findings")).length, count);
  cash = (await get("/risk-findings")).find((f: { rule: string }) => f.rule === "cash_ceiling");
  cash = await post("/risk-findings/" + cash.id + "/actions", "monitor-ack", {
    expectedRevision: cash.revision,
    action: "acknowledge",
    actor: "Risk reviewer",
    reason: "Review excess cash after initial funding",
  });
  assert.equal(cash.status, "acknowledged");
  assert.equal(cash.observation.status, "breach");
  now = "2026-09-22T12:00:00.000Z";
  const stale = await post("/monitors", "monitor-stale", request);
  assert.equal(stale.fresh, false);
  assert.equal(stale.history.status, "unavailable");
  cash = (await get("/risk-findings")).find((f: { rule: string }) => f.rule === "cash_ceiling");
  const denied = await app.inject({
    method: "POST",
    url: "/api/v1/risk-findings/" + cash.id + "/actions",
    headers: { "idempotency-key": "monitor-invalid-resolve" },
    payload: {
      expectedRevision: cash.revision,
      action: "resolve",
      actor: "Risk reviewer",
      reason: "Stale data cannot establish a passing state",
    },
  });
  assert.equal(denied.statusCode, 409);
  assert.equal(
    (await get("/risk-findings")).find((f: { id: string }) => f.id === cash.id).status,
    "acknowledged",
  );
  // At 40% per asset and 20% cash, all mandate boundaries pass.
  book = await post("/ledger/events", "monitor-more-a", {
    ...trade,
    quantity: "30",
    occurredAt: now,
    sourceRef: "monitor-more-a",
  });
  book = await post("/ledger/events", "monitor-buy-b", {
    ...trade,
    instrumentId: seed.instruments[1]!.instrumentId,
    quantity: "40",
    occurredAt: now,
    sourceRef: "monitor-buy-b",
  });
  v = await post("/valuations", "monitor-balanced", {
    portfolioId: seed.portfolio.id,
    checkpoint: book.book.checkpoint,
    asOf: now,
    prices: [],
    overrides: seed.input.newPrices.map((p) => ({ ...p, quotedAt: now })),
  });
  const balanced = await post("/monitors", "monitor-balanced-run", {
    ...request,
    valuation: { id: v.id, revision: 1 },
  });
  assert.equal(balanced.fresh, true);
  assert.ok(
    balanced.observations
      .filter((o: { rule: string }) => o.rule === "position")
      .every((o: { status: string }) => o.status === "pass"),
  );
  cash = (await get("/risk-findings")).find((f: { rule: string }) => f.rule === "cash_ceiling");
  assert.equal(cash.observation.status, "pass");
  const action = {
    expectedRevision: cash.revision,
    action: "resolve",
    actor: "Risk reviewer",
    reason: "New balanced book proves cash below the ceiling",
  };
  const resolved = await post("/risk-findings/" + cash.id + "/actions", "monitor-resolve", action);
  assert.equal(resolved.status, "resolved");
  assert.deepEqual(
    await post("/risk-findings/" + cash.id + "/actions", "monitor-resolve", action),
    resolved,
  );
  assert.equal(
    (await get("/monitors/" + first.id)).observations.find(
      (o: { rule: string }) => o.rule === "cash_ceiling",
    ).status,
    "breach",
  );
});
