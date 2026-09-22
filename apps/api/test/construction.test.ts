import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import {
  constructionRequestSchema,
  type Instrument,
  type RiskModelSnapshot,
} from "@portfolio-atlas/contracts";
import { constructTarget } from "@portfolio-atlas/core";
import { FintechConstructionEngine } from "@portfolio-atlas/adapters";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";
test("construction API keeps feasible proposals, rejected candidates, solver failures and capacity proofs distinct", async (t) => {
  const app = buildApp({ clock: { now: () => fixtureTime } });
  t.after(() => app.close());
  const post = async (path: string, key: string, payload: object) => {
    const reply = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      headers: { "idempotency-key": key },
      payload,
    });
    assert.equal(reply.statusCode, 201, reply.body);
    return reply.json().data;
  };
  const mandate = await post("/mandates", "target-mandate", demoMandate);
  const portfolio = await post("/portfolios", "target-portfolio", {
    name: "Construction lesson",
    mandateId: mandate.id,
  });
  await post("/ledger/events", "target-deposit", {
    portfolioId: portfolio.id,
    kind: "deposit",
    occurredAt: "2026-09-01T00:00:00Z",
    currency: "USD",
    amount: "10000",
    sourceRef: "target-capital",
  });
  const valuation = await post("/valuations", "target-value", {
    portfolioId: portfolio.id,
    checkpoint: 1,
    asOf: fixtureTime,
    prices: [],
  });
  const runs: { id: string; revision: number }[] = [],
    instruments: Instrument[] = [];
  for (const symbol of ["AURA", "HARB"]) {
    const candidates = (await app.inject("/api/v1/instruments/search?q=" + symbol)).json().data
      .candidates;
    const instrument = (
      await post("/instruments/resolutions", "target-instrument-" + symbol, {
        candidateId: candidates[0].candidateId,
      })
    ).instrument;
    instruments.push(instrument);
    const dataset = (
      await post("/market-data/ingestions", "target-data-" + symbol, {
        instrumentId: instrument.instrumentId,
        instrumentRevision: instrument.revision,
        from: "2026-09-01",
        to: "2026-09-18",
        scenario: "clean",
      })
    ).dataset;
    const review = await post("/corporate-actions/reviews", "target-review-" + symbol, {
      datasetId: dataset.id,
      datasetRevision: dataset.revision,
    });
    const run = await post("/adjustment-runs", "target-adjust-" + symbol, {
      reviewId: review.id,
      actionKnowledgeAt: fixtureTime,
      targetCurrency: "USD",
    });
    runs.push({ id: run.id, revision: run.revision });
  }
  const model: RiskModelSnapshot = await post("/risk-models", "target-risk", {
    adjustmentRuns: runs,
    asOf: fixtureTime,
    estimator: "ledoit_wolf",
    expectedReturnAssumption: "scenario",
    annualExpectedReturns: instruments.map((i) => ({
      instrumentId: i.instrumentId,
      annualReturn: 0.05,
    })),
  });
  const input = constructionRequestSchema.parse({
    portfolioId: portfolio.id,
    mandateRevision: 1,
    riskModel: { id: model.id, revision: 1 },
    valuation: { id: valuation.id, revision: 1 },
    method: "equal_weight",
  });
  const proposed = await post("/targets", "target-equal", input);
  assert.equal(proposed.status, "proposal");
  assert.deepEqual(proposed.weights, [0.4, 0.4]);
  assert.equal(proposed.cashWeight, 0.2);
  assert.equal(proposed.turnover, 0.8);
  assert.equal(proposed.executable, false);
  assert.equal(proposed.createsOrders, false);
  assert.deepEqual(await post("/targets", "target-equal", input), proposed);
  assert.equal(
    (await app.inject("/api/v1/portfolios/" + portfolio.id + "/book")).json().data.book.checkpoint,
    1,
  );
  const stress = await post("/targets", "target-stress", { ...input, volatilityStress: 2 });
  assert.ok(Math.abs(stress.variance - proposed.variance * 4) < 1e-12);
  const costly = await post("/targets", "target-cost", { ...input, estimatedCostBps: 1000 });
  assert.equal(costly.status, "candidate_rejected");
  assert.ok(
    costly.constraints.some(
      (r: { rule: string; status: string }) => r.rule === "ESTIMATED_COST" && r.status === "fail",
    ),
  );
  const impossible = await post("/targets", "target-fixed-cash", { ...input, cashWeight: 0 });
  assert.equal(impossible.status, "infeasible");
  const turnover = await post("/targets", "target-turnover", {
    ...input,
    method: "turnover_constrained",
    turnoverCap: 0,
  });
  assert.equal(turnover.solver.status, "optimal");
  assert.equal(turnover.status, "candidate_rejected");
  assert.equal(turnover.cashWeight, 1);
  const limited = await post("/targets", "target-iteration-budget", {
    ...input,
    method: "turnover_constrained",
    maxIterations: 0,
  });
  assert.equal(limited.status, "solver_failed");
  const wrongRevision = await app.inject({
    method: "POST",
    url: "/api/v1/targets",
    headers: { "idempotency-key": "target-wrong-revision" },
    payload: { ...input, riskModel: { id: model.id, revision: 2 } },
  });
  assert.equal(wrongRevision.statusCode, 409);
  const engine = new FintechConstructionEngine();
  // Independently supplied asymmetric covariance isolates policy rejection from solver failure.
  const asymmetric = {
    ...model,
    covarianceAnnual: [
      [0.04, 0.01],
      [0.01, 0.09],
    ],
  };
  const rejected = constructTarget(
    { ...input, method: "minimum_variance" },
    mandate,
    asymmetric,
    valuation,
    instruments,
    engine,
    fixtureTime,
  );
  assert.equal(rejected.solver!.status, "optimal");
  assert.equal(rejected.status, "candidate_rejected");
  assert.ok(rejected.constraints.some((r) => r.rule === "POSITION_LIMIT" && r.status === "fail"));
  assert.equal(
    constructTarget(
      input,
      { ...mandate, maxPositionWeight: 0.3 },
      model,
      valuation,
      instruments,
      engine,
      fixtureTime,
    ).status,
    "infeasible",
  );
  const unknown = structuredClone(instruments);
  unknown[0]!.sector = null;
  assert.equal(
    constructTarget(input, mandate, model, valuation, unknown, engine, fixtureTime).status,
    "unsupported",
  );
  assert.deepEqual((await app.inject("/api/v1/targets/" + proposed.id)).json().data, proposed);
});
