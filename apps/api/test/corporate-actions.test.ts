import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
import { adjustmentResultSchema, envelopeSchema } from "@portfolio-atlas/contracts";
test("HTTP action review, cutoff revisions and adjustment replay preserve the parent dataset", async (t) => {
  const app = buildApp({ clock: { now: () => fixtureTime } });
  t.after(() => app.close());
  const post = (url: string, key: string, payload: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/v1" + url,
      headers: { "idempotency-key": key },
      payload: payload as Record<string, unknown>,
    });
  const search = (await app.inject("/api/v1/instruments/search?q=AURA")).json().data;
  const instrument = (
    await post("/instruments/resolutions", "actions-resolve", {
      candidateId: search.candidates[0].candidateId,
    })
  ).json().data.instrument;
  const dataset = (
    await post("/market-data/ingestions", "actions-candles", {
      instrumentId: instrument.instrumentId,
      instrumentRevision: instrument.revision,
      from: "2026-09-01",
      to: "2026-09-18",
      scenario: "corporate-actions",
    })
  ).json().data.dataset;
  assert.equal(dataset.quality.acceptedIndexes.length, 12);
  const review = (
    await post("/corporate-actions/reviews", "actions-review", {
      datasetId: dataset.id,
      datasetRevision: 1,
    })
  ).json().data;
  assert.equal(review.actions.length, 4);
  const input = {
    reviewId: review.id,
    actionKnowledgeAt: "2026-09-09T00:00:00Z",
    targetCurrency: "EUR",
  };
  const first = await post("/adjustment-runs", "actions-run-1", input);
  assert.equal(first.statusCode, 201);
  const run = envelopeSchema(adjustmentResultSchema).parse(first.json()).data;
  assert.equal(run.series[0]!.splitAdjustedClose, 50);
  assert.equal(run.revision, 1);
  assert.equal((await post("/adjustment-runs", "actions-run-1", input)).json().data.revision, 1);
  const revised = (
    await post("/adjustment-runs", "actions-run-2", {
      ...input,
      actionKnowledgeAt: "2026-09-16T00:00:00Z",
    })
  ).json().data;
  assert.equal(revised.revision, 2);
  assert.notEqual(revised.series[0].totalReturnClose, run.series[0]!.totalReturnClose);
  assert.deepEqual(
    (await app.inject("/api/v1/adjustment-runs/" + run.id + "?revision=1")).json().data,
    run,
  );
  assert.deepEqual(
    (await app.inject("/api/v1/datasets/" + dataset.id + "?revision=1")).json().data,
    dataset,
  );
  const future = await post("/adjustment-runs", "future-cutoff", {
    ...input,
    actionKnowledgeAt: "2026-09-23T00:00:00Z",
  });
  assert.equal(future.statusCode, 409);
});
