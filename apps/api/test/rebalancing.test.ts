import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
import { rebalanceProposalSchema } from "@portfolio-atlas/contracts";
import { seedTrading } from "../../../tests/helpers/seed-trading.js";
test("rebalance API approves once and invalidates changed book, valuation, instrument and expired evidence", async (t) => {
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
  const seed = await seedTrading(get, post, "rebalance-api", () => now);
  const proposal = rebalanceProposalSchema.parse(
    await post("/rebalances", "rebalance-plan", seed.input),
  );
  assert.equal(proposal.status, "ready");
  assert.equal(proposal.cashBridge.closing, "2192.20");
  assert.deepEqual(await post("/rebalances", "rebalance-plan", seed.input), proposal);
  const approved = await post("/rebalances/" + proposal.id + "/approval", "rebalance-approve", {
    expectedRevision: 1,
  });
  assert.equal(approved.status, "approved");
  assert.equal(approved.revision, 2);
  assert.equal((await get("/portfolios/" + seed.portfolio.id + "/book")).book.checkpoint, 1);
  assert.equal((await get("/rebalances/" + proposal.id + "?revision=1")).status, "ready");
  const pending = await post("/rebalances", "rebalance-plan-2", seed.input);
  const failedApproval = async (id: string, key: string) =>
    app.inject({
      method: "POST",
      url: "/api/v1/rebalances/" + id + "/approval",
      headers: { "idempotency-key": key },
      payload: { expectedRevision: 1 },
    });
  const revised = await post("/valuations", "rebalance-new-value", {
    portfolioId: seed.portfolio.id,
    checkpoint: 1,
    asOf: now,
    prices: [],
  });
  assert.equal((await failedApproval(pending.id, "rebalance-stale-price")).statusCode, 409);
  const currentInput = { ...seed.input, valuation: { id: revised.id, revision: 1 } };
  const expiring = await post("/rebalances", "rebalance-expiring", currentInput);
  now = "2026-09-22T10:16:00.000Z";
  assert.equal((await failedApproval(expiring.id, "rebalance-expired")).statusCode, 409);
  now = fixtureTime;
  const bookChanged = await post("/rebalances", "rebalance-book-change", currentInput);
  await post("/ledger/events", "rebalance-new-capital", {
    portfolioId: seed.portfolio.id,
    kind: "deposit",
    currency: "USD",
    amount: "500",
    occurredAt: now,
    sourceRef: "new-contribution",
  });
  assert.equal((await failedApproval(bookChanged.id, "rebalance-stale-book")).statusCode, 409);
  const value2 = await post("/valuations", "rebalance-value2", {
    portfolioId: seed.portfolio.id,
    checkpoint: 2,
    asOf: now,
    prices: [],
  });
  const withCapital = await post("/rebalances", "rebalance-more-capital", {
    ...currentInput,
    valuation: { id: value2.id, revision: 1 },
  });
  assert.equal(withCapital.startingNav, "10500.00");
  assert.equal(withCapital.trades[0].quantity, "41.00000000");
  const search = await get("/instruments/search?q=AURA");
  await post("/instruments/resolutions", "rebalance-instrument-revision", {
    candidateId: search.candidates[0].candidateId,
  });
  assert.equal(
    (await failedApproval(withCapital.id, "rebalance-stale-instrument")).statusCode,
    409,
  );
});
