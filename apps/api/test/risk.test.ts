import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
test("risk API preserves ordered snapshots, singularity, scenario units and estimator sensitivity", async (t) => {
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
  const runs: { id: string; revision: number }[] = [],
    ids: string[] = [];
  for (const symbol of ["AURA", "HARB"]) {
    const candidates = (await app.inject("/api/v1/instruments/search?q=" + symbol)).json().data
      .candidates;
    const instrument = (
      await post("/instruments/resolutions", "risk-instrument-" + symbol, {
        candidateId: candidates[0].candidateId,
      })
    ).instrument;
    ids.push(instrument.instrumentId);
    const dataset = (
      await post("/market-data/ingestions", "risk-data-" + symbol, {
        instrumentId: instrument.instrumentId,
        instrumentRevision: instrument.revision,
        from: "2026-09-01",
        to: "2026-09-18",
        scenario: "clean",
      })
    ).dataset;
    const review = await post("/corporate-actions/reviews", "risk-review-" + symbol, {
      datasetId: dataset.id,
      datasetRevision: dataset.revision,
    });
    const run = await post("/adjustment-runs", "risk-adjust-" + symbol, {
      reviewId: review.id,
      actionKnowledgeAt: fixtureTime,
      targetCurrency: "USD",
    });
    assert.equal(run.status, "ready");
    runs.push({ id: run.id, revision: run.revision });
  }
  const input = {
    adjustmentRuns: runs,
    asOf: fixtureTime,
    expectedReturnAssumption: "scenario",
    annualExpectedReturns: [
      { instrumentId: ids[1], annualReturn: 0.04 },
      { instrumentId: ids[0], annualReturn: 0.08 },
    ],
  };
  const model = await post("/risk-models", "risk-create-model", input);
  assert.equal(model.status, "ready");
  assert.equal(model.observations, 11);
  assert.equal(model.diagnostics.rank, 1);
  assert.equal(model.diagnostics.positiveDefinite, false);
  assert.equal(model.correlation[0][1], 1);
  assert.deepEqual(model.annualExpectedReturns, [0.08, 0.04]);
  assert.deepEqual(await post("/risk-models", "risk-create-model", input), model);
  const reordered = await post("/risk-models", "risk-permuted", {
    ...input,
    adjustmentRuns: [...runs].reverse(),
  });
  assert.deepEqual(reordered.annualExpectedReturns, [0.04, 0.08]);
  assert.deepEqual(
    reordered.assets.map((a: { instrumentId: string }) => a.instrumentId),
    [...ids].reverse(),
  );
  const comparison = await post("/risk-models", "risk-shrinkage", {
    ...input,
    estimator: "ledoit_wolf",
  });
  assert.equal(comparison.status, "ready");
  assert.equal(comparison.diagnostics.positiveDefinite, true);
  const logarithmic = await post("/risk-models", "risk-logarithmic", {
    ...input,
    returnType: "log",
  });
  assert.ok(Math.abs(logarithmic.returns[0][0] - Math.log(102 / 101)) < 1e-12);
  const duplicate = await post("/risk-models", "risk-duplicate", {
    ...input,
    adjustmentRuns: [runs[0], runs[0]],
  });
  assert.equal(duplicate.status, "unavailable");
  const missingScenario = await post("/risk-models", "risk-scenario-missing", {
    ...input,
    annualExpectedReturns: [],
  });
  assert.equal(missingScenario.status, "unavailable");
  const old = await post("/risk-models", "risk-old-observations", {
    ...input,
    asOf: "2026-09-18T00:00:00Z",
  });
  assert.equal(old.status, "unavailable");
  assert.deepEqual((await app.inject("/api/v1/risk-models/" + model.id)).json().data, model);
});
