import { MemoryRawArchive } from "@portfolio-atlas/adapters";
import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
import { envelopeSchema, ingestionResultSchema } from "@portfolio-atlas/contracts";
test("ingestion HTTP journey archives rows, preserves revisions and replays one command", async (t) => {
  const app = buildApp({ clock: { now: () => fixtureTime } });
  t.after(() => app.close());
  const search = (await app.inject("/api/v1/instruments/search?q=AURA")).json().data;
  const resolution = await app.inject({
    method: "POST",
    url: "/api/v1/instruments/resolutions",
    headers: { "idempotency-key": "quality-resolve" },
    payload: { candidateId: search.candidates[0].candidateId },
  });
  const instrument = resolution.json().data.instrument;
  const payload = {
    instrumentId: instrument.instrumentId,
    instrumentRevision: 1,
    from: "2026-09-01",
    to: "2026-09-18",
    scenario: "adversarial",
  };
  const ingest = (key: string) =>
    app.inject({
      method: "POST",
      url: "/api/v1/market-data/ingestions",
      headers: { "idempotency-key": key },
      payload,
    });
  const first = await ingest("quality-ingest-1");
  assert.equal(first.statusCode, 201);
  const dataset = envelopeSchema(ingestionResultSchema).parse(first.json()).data.dataset!;
  assert.equal(dataset.rows.length, 12);
  assert.deepEqual(dataset.quality.acceptedIndexes, [0, 3, 5, 11]);
  assert.equal((await ingest("quality-ingest-1")).json().data.dataset.revision, 1);
  assert.equal((await ingest("quality-ingest-2")).json().data.dataset.revision, 2);
  const history = (await app.inject("/api/v1/datasets/" + dataset.id + "?revision=1")).json().data;
  assert.deepEqual(history, dataset);
  const quality = (await app.inject("/api/v1/datasets/" + dataset.id + "/quality")).json().data;
  assert.equal(quality.quarantinedIndexes.length, 8);
  const invalid = await app.inject({
    method: "POST",
    url: "/api/v1/market-data/ingestions",
    headers: { "idempotency-key": "bad-window" },
    payload: { ...payload, to: payload.from },
  });
  assert.equal(invalid.statusCode, 400);
});

test("archive failure publishes no dataset and the identical command can safely retry", async (t) => {
  let fail = true;
  const archive = new MemoryRawArchive();
  const app = buildApp({
    clock: { now: () => fixtureTime },
    rawArchive: {
      read: (hash) => archive.read(hash),
      save: async (raw) => {
        if (fail) throw new Error("disk unavailable");
        return archive.save(raw);
      },
    },
  });
  t.after(() => app.close());
  const search = (await app.inject("/api/v1/instruments/search?q=AURA")).json().data;
  const resolved = await app.inject({
    method: "POST",
    url: "/api/v1/instruments/resolutions",
    headers: { "idempotency-key": "archive-resolve" },
    payload: { candidateId: search.candidates[0].candidateId },
  });
  const payload = {
    instrumentId: resolved.json().data.instrument.instrumentId,
    instrumentRevision: 1,
    from: "2026-09-01",
    to: "2026-09-18",
    scenario: "clean",
  };
  const ingest = () =>
    app.inject({
      method: "POST",
      url: "/api/v1/market-data/ingestions",
      headers: { "idempotency-key": "archive-failure-retry" },
      payload,
    });
  assert.equal((await ingest()).statusCode, 500);
  assert.deepEqual((await app.inject("/api/v1/datasets")).json().data, []);
  fail = false;
  const retry = await ingest();
  assert.equal(retry.statusCode, 201);
  assert.equal(retry.json().data.dataset.revision, 1);
  assert.equal(archive.entries.size, 1);
});
