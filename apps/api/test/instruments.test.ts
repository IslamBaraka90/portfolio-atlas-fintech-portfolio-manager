import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";
import {
  envelopeSchema,
  instrumentSchema,
  resolveResultSchema,
  searchResultSchema,
} from "@portfolio-atlas/contracts";
test("instrument API preserves two candidates, saved identity and revision-aware eligibility", async (t) => {
  const app = buildApp({ clock: { now: () => fixtureTime } });
  t.after(() => app.close());
  const searched = await app.inject("/api/v1/instruments/search?q=Aurora");
  const candidates = envelopeSchema(searchResultSchema).parse(searched.json()).data.candidates;
  assert.equal(candidates.length, 2);
  const resolved = await app.inject({
    method: "POST",
    url: "/api/v1/instruments/resolutions",
    headers: { "idempotency-key": "resolve-aurora" },
    payload: { candidateId: candidates[0]!.candidateId },
  });
  assert.equal(resolved.statusCode, 201);
  const instrument = envelopeSchema(resolveResultSchema).parse(resolved.json()).data.instrument!;
  assert.equal(
    envelopeSchema(instrumentSchema).parse(
      (await app.inject("/api/v1/instruments/" + instrument.instrumentId)).json(),
    ).data.tickSize,
    0.01,
  );
  const mandate = (
    await app.inject({
      method: "POST",
      url: "/api/v1/mandates",
      headers: { "idempotency-key": "create-mandate" },
      payload: demoMandate,
    })
  ).json().data;
  const input = {
    instrumentId: instrument.instrumentId,
    instrumentRevision: 1,
    mandateId: mandate.id,
    mandateRevision: 1,
  };
  const decision = await app.inject({
    method: "POST",
    url: "/api/v1/universe/evaluations",
    headers: { "idempotency-key": "evaluate-universe" },
    payload: input,
  });
  assert.equal(decision.statusCode, 201);
  assert.equal(decision.json().data.status, "eligible");
  const stale = await app.inject({
    method: "POST",
    url: "/api/v1/universe/evaluations",
    headers: { "idempotency-key": "stale-universe" },
    payload: { ...input, instrumentRevision: 99 },
  });
  assert.equal(stale.statusCode, 409);
});
test("live mode is disabled by default without a network attempt; aliases are inspectable", async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  const disabled = await app.inject("/api/v1/instruments/search?q=AAPL&mode=yahoo");
  assert.equal(disabled.statusCode, 200);
  assert.equal(disabled.json().data.failure.code, "DISABLED");
  assert.equal(disabled.json().metadata.mode, "yahoo");
  const alias = await app.inject(
    "/api/v1/instruments/alias-resolution?symbol=AUR-OLD&venueMic=XNAS&validAt=2025-06-01T00%3A00%3A00Z&knowledgeAt=2026-01-01T00%3A00%3A00Z",
  );
  assert.equal(alias.json().data.canonicalId, "DEMO-AURORA-US");
});
