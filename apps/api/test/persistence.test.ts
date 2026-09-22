import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { buildApp } from "../src/app.js";
import { FileRawArchive } from "@portfolio-atlas/adapters";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";
test("SQLite restart preserves policies, identities, dataset archives, reviews and command replay", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-atlas-restart-"));
  const options = {
    databasePath: join(directory, "book.sqlite"),
    clock: { now: () => fixtureTime },
    rawArchive: new FileRawArchive(join(directory, "raw")),
  };
  let app = buildApp(options);
  t.after(async () => {
    await app.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("portfolio-atlas-restart-"));
    await rm(directory, { recursive: true, force: true });
  });
  const post = (url: string, key: string, payload: Record<string, unknown>) =>
    app.inject({
      method: "POST",
      url: "/api/v1" + url,
      headers: { "idempotency-key": key },
      payload,
    });
  const mandate = (await post("/mandates", "persist-mandate", demoMandate)).json().data;
  const portfolio = (
    await post("/portfolios", "persist-portfolio", {
      name: "Durable learning portfolio",
      mandateId: mandate.id,
    })
  ).json().data;
  assert.ok(portfolio.id);
  const candidates = (await app.inject("/api/v1/instruments/search?q=AURA")).json().data.candidates;
  const resolution = { candidateId: candidates[0].candidateId };
  const instrument = (
    await post("/instruments/resolutions", "persist-instrument", resolution)
  ).json().data.instrument;
  const ingestion = {
    instrumentId: instrument.instrumentId,
    instrumentRevision: 1,
    from: "2026-09-01",
    to: "2026-09-18",
    scenario: "corporate-actions",
  };
  const dataset = (await post("/market-data/ingestions", "persist-dataset", ingestion)).json().data
    .dataset;
  const review = (
    await post("/corporate-actions/reviews", "persist-review", {
      datasetId: dataset.id,
      datasetRevision: 1,
    })
  ).json().data;
  const result = (
    await post("/adjustment-runs", "persist-adjustment", {
      reviewId: review.id,
      actionKnowledgeAt: "2026-09-09T00:00:00Z",
      targetCurrency: "EUR",
    })
  ).json().data;
  const sessionId = (await app.inject("/api/v1/health")).json().sessionId;
  await app.close();
  app = buildApp(options);
  assert.equal((await app.inject("/api/v1/health")).json().sessionId, sessionId);
  const saved = await app.inject("/api/v1/portfolios/" + portfolio.id);
  assert.equal(saved.json().metadata.storage, "sqlite");
  assert.equal(saved.json().data.id, portfolio.id);
  assert.deepEqual(
    (await post("/instruments/resolutions", "persist-instrument", resolution)).json().data
      .instrument,
    instrument,
  );
  assert.deepEqual(
    (await post("/market-data/ingestions", "persist-dataset", ingestion)).json().data.dataset,
    dataset,
  );
  assert.deepEqual(
    (await app.inject("/api/v1/adjustment-runs/" + result.id + "?revision=1")).json().data,
    result,
  );
  const newReview = await post("/corporate-actions/reviews", "persist-review-after-restart", {
    datasetId: dataset.id,
    datasetRevision: 1,
  });
  assert.equal(newReview.statusCode, 201);
  assert.equal(newReview.json().data.actions.length, 4);
});
