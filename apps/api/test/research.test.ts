import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
test("research API freezes exact revisions, replays commands and rejects duplicate/future inputs", async (t) => {
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
  const candidates = (await app.inject("/api/v1/instruments/search?q=AURA")).json().data.candidates;
  const instrument = (
    await post("/instruments/resolutions", "research-instrument", {
      candidateId: candidates[0].candidateId,
    })
  ).instrument;
  const dataset = (
    await post("/market-data/ingestions", "research-data", {
      instrumentId: instrument.instrumentId,
      instrumentRevision: 1,
      from: "2026-09-01",
      to: "2026-09-18",
      scenario: "clean",
    })
  ).dataset;
  const capture = {
    instrumentId: instrument.instrumentId,
    instrumentRevision: 1,
    from: "2024-01-01",
    to: "2026-01-01",
    frequency: "annual",
    scenario: "standard",
  };
  const company = (await post("/company-observations", "research-company", capture)).observation;
  const input = {
    series: [{ dataset: { id: dataset.id, revision: 1 } }],
    companies: [{ id: company.id, revision: 1 }],
    asOf: fixtureTime,
  };
  const result = await post("/research-runs", "research-calculate", input);
  assert.equal(result.fundamentals[0].focusPercentage, 15);
  assert.equal(result.createsOrders, false);
  assert.deepEqual(await post("/research-runs", "research-calculate", input), result);
  const newer = (await post("/company-observations", "research-company-second", capture))
    .observation;
  assert.equal(newer.revision, 2);
  assert.equal(
    (await app.inject("/api/v1/company-observations/" + company.id + "?revision=1")).json().data
      .revision,
    1,
  );
  assert.deepEqual((await app.inject("/api/v1/research-runs/" + result.id)).json().data, result);
  for (const [key, changes] of [
    ["future", { asOf: "2099-01-01T00:00:00Z" }],
    ["duplicates", { series: [...input.series, ...input.series] }],
  ] as const) {
    const reply = await app.inject({
      method: "POST",
      url: "/api/v1/research-runs",
      headers: { "idempotency-key": "research-bad-" + key },
      payload: { ...input, ...changes },
    });
    assert.equal(reply.statusCode, 409, reply.body);
  }
  const missing = (
    await post("/company-observations", "research-company-missing", {
      ...capture,
      scenario: "missing",
    })
  ).observation;
  const unavailable = await post("/research-runs", "research-missing", {
    ...input,
    companies: [{ id: missing.id, revision: 1 }],
  });
  assert.equal(unavailable.fundamentals[0].status, "unavailable");
  assert.equal(unavailable.fundamentals[0].focusPercentage, null);
});
