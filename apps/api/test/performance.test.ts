import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";
test("performance separates immediate external cash, net fees, missing flow boundaries and immutable evidence", async (t) => {
  let now = fixtureTime;
  const app = buildApp({ clock: { now: () => now } });
  t.after(() => app.close());
  const post = async (path: string, key: string, payload: object) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      headers: { "idempotency-key": "chapter-15-" + key },
      payload,
    });
    assert.equal(r.statusCode, 201, r.body);
    return r.json().data;
  };
  const m = await post("/mandates", "perf-m", demoMandate),
    p = await post("/portfolios", "perf-p", { name: "Performance lesson", mandateId: m.id });
  let state = await post("/ledger/events", "perf-opening", {
    portfolioId: p.id,
    kind: "deposit",
    currency: "USD",
    amount: "10095",
    occurredAt: now,
    sourceRef: "perf-opening",
  });
  const value = (key: string) =>
    post("/valuations", key, {
      portfolioId: p.id,
      checkpoint: state.book.checkpoint,
      asOf: now,
      prices: [],
    });
  const a = await value("perf-a");
  state = await post("/ledger/events", "perf-deposit", {
    portfolioId: p.id,
    kind: "deposit",
    currency: "USD",
    amount: "500",
    occurredAt: now,
    sourceRef: "perf-deposit",
  });
  const b = await value("perf-b"),
    request = {
      valuations: [
        { id: a.id, revision: 1 },
        { id: b.id, revision: 1 },
      ],
    };
  const immediate = await post("/performance", "perf-immediate", request);
  assert.equal(immediate.twr.value, 0);
  assert.equal(immediate.investmentProfit, "0.00");
  assert.equal(immediate.externalFlows[0].amount, "500.00");
  assert.equal(immediate.moneyWeighted.status, "unavailable");
  assert.deepEqual(await post("/performance", "perf-immediate", request), immediate);
  now = "2026-09-23T10:00:00.000Z";
  state = await post("/ledger/events", "perf-fee", {
    portfolioId: p.id,
    kind: "fee",
    currency: "USD",
    amount: "105.95",
    occurredAt: now,
    sourceRef: "perf-fee",
  });
  const c = await value("perf-c");
  const net = await post("/performance", "perf-net", {
    valuations: [
      { id: b.id, revision: 1 },
      { id: c.id, revision: 1 },
    ],
  });
  assert.ok(Math.abs(net.twr.value + 0.01) < 1e-12);
  assert.equal(net.feeAddedBackTwr.value, 0);
  assert.equal(net.investmentProfit, "-105.95");
  assert.equal(net.moneyWeighted.annualizedReturn, null);
  now = "2026-09-24T10:00:00.000Z";
  state = await post("/ledger/events", "perf-midflow", {
    portfolioId: p.id,
    kind: "deposit",
    currency: "USD",
    amount: "100",
    occurredAt: now,
    sourceRef: "perf-midflow",
  });
  now = "2026-09-25T10:00:00.000Z";
  const d = await value("perf-d");
  const missing = await post("/performance", "perf-missing", {
    valuations: [
      { id: c.id, revision: 1 },
      { id: d.id, revision: 1 },
    ],
  });
  assert.equal(missing.twr.status, "unavailable");
  assert.match(missing.twr.reason, /Missing valuation/);
  assert.equal(missing.modifiedDietz.value, 0);
  const unchanged = (await app.inject("/api/v1/performance/" + immediate.id)).json().data;
  assert.deepEqual(unchanged, immediate);
  const reverse = await app.inject({
    method: "POST",
    url: "/api/v1/performance",
    headers: { "idempotency-key": "perf-reverse" },
    payload: {
      valuations: [
        { id: d.id, revision: 1 },
        { id: a.id, revision: 1 },
      ],
    },
  });
  assert.equal(reverse.statusCode, 409);
});
