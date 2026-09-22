import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { buildApp } from "../src/app.js";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";
test("frozen NAV and benchmark API retain checkpoint, source revisions and restart evidence", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-atlas-valuation-")),
    databasePath = join(directory, "book.sqlite");
  let app = buildApp({ databasePath, clock: { now: () => fixtureTime } });
  t.after(async () => {
    await app.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("portfolio-atlas-valuation-"));
    await rm(directory, { recursive: true, force: true });
  });
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
  const mandate = await post("/mandates", "value-mandate", demoMandate);
  const portfolio = await post("/portfolios", "value-portfolio", {
    name: "Valuation lesson",
    mandateId: mandate.id,
  });
  const candidates = (await app.inject("/api/v1/instruments/search?q=AURA")).json().data.candidates;
  const instrument = (
    await post("/instruments/resolutions", "value-instrument", {
      candidateId: candidates[0].candidateId,
    })
  ).instrument;
  const base = { portfolioId: portfolio.id, occurredAt: "2026-09-01T00:00:00Z", currency: "USD" };
  await post("/ledger/events", "value-deposit", {
    ...base,
    kind: "deposit",
    amount: "10000",
    sourceRef: "deposit-one",
  });
  await post("/ledger/events", "value-buy", {
    ...base,
    kind: "buy",
    quantity: "10",
    unitPrice: "100",
    fee: "5",
    sourceRef: "buy-one",
    instrumentId: instrument.instrumentId,
    instrumentRevision: 1,
  });
  const ingestion = {
    instrumentId: instrument.instrumentId,
    instrumentRevision: 1,
    from: "2026-09-01",
    to: "2026-09-18",
    scenario: "clean",
  };
  const dataset = (await post("/market-data/ingestions", "value-data", ingestion)).dataset;
  const review = await post("/corporate-actions/reviews", "value-review", {
    datasetId: dataset.id,
    datasetRevision: 1,
  });
  const request = {
    portfolioId: portfolio.id,
    checkpoint: 2,
    asOf: fixtureTime,
    prices: [
      {
        instrumentId: instrument.instrumentId,
        dataset: { id: dataset.id, revision: 1 },
        rowId: dataset.rows.find((r: { close: number }) => r.close === 110).rowId,
        reviewId: review.id,
      },
    ],
  };
  const first = await post("/valuations", "value-first", request);
  assert.equal(first.totals.nav, "10095.00");
  assert.equal(first.positions[0].mark.status, "accepted");
  for (const [suffix, changes] of [
    ["unknown-checkpoint", { checkpoint: 99 }],
    ["future", { asOf: "2099-01-01T00:00:00Z" }],
    ["unrecorded-book", { asOf: "2026-09-01T00:00:00Z" }],
  ] as const) {
    const rejected = await app.inject({
      method: "POST",
      url: "/api/v1/valuations",
      headers: { "idempotency-key": "value-invalid-" + suffix },
      payload: { ...request, ...changes },
    });
    assert.equal(rejected.statusCode, 409, rejected.body);
    assert.equal(rejected.json().error.code, "INVALID_SNAPSHOT");
  }
  await post("/ledger/events", "value-deposit-more", {
    ...base,
    kind: "deposit",
    amount: "500",
    sourceRef: "deposit-two",
  });
  const second = await post("/valuations", "value-second", { ...request, checkpoint: 3 });
  assert.equal(second.totals.nav, "10595.00");
  assert.equal(second.externalCapital[0].netContributed, "10500.00");
  await post("/market-data/ingestions", "value-data-new-revision", ingestion);
  const replay = await post("/valuations", "value-old-checkpoint", request);
  assert.deepEqual(replay.totals, first.totals);
  assert.equal(replay.book.checkpoint, 2);
  assert.equal(replay.positions[0].mark.dataset.revision, 1);
  assert.equal(
    (await post("/valuations", "value-stale", { ...request, maxPriceAgeSeconds: 1 })).totals.nav,
    null,
  );
  assert.equal(
    (await post("/valuations", "value-missing", { ...request, prices: [] })).totals.nav,
    null,
  );
  const adjustment = await post("/adjustment-runs", "value-adjustment", {
    reviewId: review.id,
    actionKnowledgeAt: fixtureTime,
    targetCurrency: "EUR",
  });
  await post("/ledger/events", "value-eur", {
    ...base,
    kind: "deposit",
    currency: "EUR",
    amount: "90",
    sourceRef: "deposit-eur",
  });
  assert.equal(
    (await post("/valuations", "value-missing-fx", { ...request, checkpoint: 4 })).totals.nav,
    null,
  );
  const fxValue = await post("/valuations", "value-fx", {
    ...request,
    checkpoint: 4,
    fxRuns: [{ id: adjustment.id, revision: adjustment.revision }],
  });
  assert.equal(fxValue.totals.nav, "10695.00");
  const definition = await post("/benchmark-definitions", "value-benchmark-definition", {
    name: "AURA price baseline",
    currency: "USD",
    returnBasis: "price",
    adjustmentRuns: [{ id: adjustment.id, revision: adjustment.revision }],
  });
  const benchmark = await post("/benchmarks", "value-benchmark", { definitionId: definition.id });
  assert.equal(benchmark.status, "ready", JSON.stringify(benchmark));
  assert.ok(Math.abs(benchmark.totalReturn - 11 / 101) < 1e-6);
  const mismatch = (
    await app.inject(
      "/api/v1/benchmarks/" + benchmark.id + "/comparison?basis=gross_total_return&currency=USD",
    )
  ).json().data;
  assert.equal(mismatch.status, "incompatible");
  await app.close();
  app = buildApp({ databasePath, clock: { now: () => fixtureTime } });
  assert.deepEqual((await app.inject("/api/v1/valuations/" + first.id)).json().data, first);
  assert.deepEqual((await app.inject("/api/v1/benchmarks/" + benchmark.id)).json().data, benchmark);
  assert.deepEqual(await post("/valuations", "value-first", request), first);
});
