import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { envelopeSchema, evaluationSchema, mandateSchema } from "@portfolio-atlas/contracts";
import {
  balancedAllocation,
  concentratedAllocation,
  demoMandate,
  fixtureTime,
} from "@portfolio-atlas/testing";

function setup() {
  let counter = 0;
  return buildApp({ clock: { now: () => fixtureTime }, ids: { next: () => "test-" + ++counter } });
}
test("HTTP journey preserves revisions, provenance, audit and duplicate-command semantics", async (t) => {
  const app = setup();
  t.after(() => app.close());
  const command = {
    method: "POST" as const,
    url: "/api/v1/mandates",
    payload: demoMandate,
    headers: { "idempotency-key": "create-mandate" },
  };
  const created = await app.inject(command);
  assert.equal(created.statusCode, 201);
  const mandate = envelopeSchema(mandateSchema).parse(created.json()).data;
  const repeated = await app.inject(command);
  assert.deepEqual(repeated.json().data, mandate);
  const conflict = await app.inject({
    ...command,
    payload: { ...demoMandate, name: "Changed name" },
  });
  assert.equal(conflict.statusCode, 409);
  const portfolio = await app.inject({
    method: "POST",
    url: "/api/v1/portfolios",
    payload: { name: "My learning portfolio", mandateId: mandate.id },
    headers: { "idempotency-key": "create-portfolio" },
  });
  assert.equal(portfolio.statusCode, 201);
  assert.equal(portfolio.json().data.baseCurrency, "USD");
  const evaluated = await app.inject({
    method: "POST",
    url: "/api/v1/mandates/" + mandate.id + "/evaluations",
    payload: { expectedRevision: 1, allocation: concentratedAllocation },
    headers: { "idempotency-key": "evaluate-allocation" },
  });
  assert.equal(evaluated.statusCode, 201);
  const body = envelopeSchema(evaluationSchema).parse(evaluated.json());
  assert.equal(body.data.result.status, "breached");
  assert.equal(body.data.mandateRevision, 1);
  assert.equal(body.metadata.mode, "synthetic");
  assert.equal(body.metadata.storage, "memory");
  assert.equal(
    (await app.inject("/api/v1/evaluations/" + body.data.id)).json().data.id,
    body.data.id,
  );
  const updated = await app.inject({
    method: "PUT",
    url: "/api/v1/mandates/" + mandate.id,
    payload: { expectedRevision: 1, mandate: { ...demoMandate, maxPositionWeight: 0.6 } },
    headers: { "idempotency-key": "update-mandate" },
  });
  assert.equal(updated.json().data.revision, 2);
  const stale = await app.inject({
    method: "POST",
    url: "/api/v1/mandates/" + mandate.id + "/evaluations",
    payload: { expectedRevision: 1, allocation: balancedAllocation },
    headers: { "idempotency-key": "evaluate-stale" },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error.code, "REVISION_CONFLICT");
  assert.equal(
    (await app.inject("/api/v1/mandates/" + mandate.id + "/revisions")).json().data.length,
    2,
  );
  const audit = (await app.inject("/api/v1/audit-events")).json().data;
  assert.equal(audit.length, 4);
  assert.equal(audit[2].requestId, body.requestId);
});
test("schema errors are 400; valid but invalid allocations are 201 with reasons", async (t) => {
  const app = setup();
  t.after(() => app.close());
  const invalid = await app.inject({
    method: "POST",
    url: "/api/v1/mandates",
    payload: { ...demoMandate, maxPositionWeight: 40 },
    headers: { "idempotency-key": "invalid-mandate" },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error.fields[0].path, "maxPositionWeight");
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/mandates",
    payload: demoMandate,
    headers: { "idempotency-key": "create-mandate" },
  });
  const evaluated = await app.inject({
    method: "POST",
    url: "/api/v1/mandates/" + created.json().data.id + "/evaluations",
    payload: { expectedRevision: 1, allocation: { ...balancedAllocation, cashWeight: 0.2 } },
    headers: { "idempotency-key": "invalid-allocation" },
  });
  assert.equal(evaluated.statusCode, 201);
  assert.equal(evaluated.json().data.result.status, "invalid");
  const missingKey = await app.inject({
    method: "POST",
    url: "/api/v1/mandates",
    payload: demoMandate,
  });
  assert.equal(missingKey.statusCode, 400);
});
test("sessions are isolated and unknown routes/resources have structured errors", async (t) => {
  const first = setup();
  const second = setup();
  t.after(async () => {
    await first.close();
    await second.close();
  });
  await first.inject({
    method: "POST",
    url: "/api/v1/mandates",
    payload: demoMandate,
    headers: { "idempotency-key": "create-mandate" },
  });
  assert.deepEqual((await second.inject("/api/v1/mandates")).json().data, []);
  assert.notEqual(
    (await first.inject("/api/v1/health")).json().sessionId,
    (await second.inject("/api/v1/health")).json().sessionId,
  );
  assert.equal((await second.inject("/api/v1/mandates/missing")).statusCode, 404);
  assert.equal((await first.inject("/missing")).json().error.code, "NOT_FOUND");
});
test("malformed JSON and non-local browser origins fail explicitly", async (t) => {
  const app = setup();
  t.after(() => app.close());
  const malformed = await app.inject({
    method: "POST",
    url: "/api/v1/mandates",
    payload: "{",
    headers: { "content-type": "application/json" },
  });
  assert.equal(malformed.statusCode, 400);
  const crossOrigin = await app.inject({
    method: "POST",
    url: "/api/v1/mandates",
    payload: demoMandate,
    headers: { origin: "https://example.com", "idempotency-key": "create-mandate" },
  });
  assert.equal(crossOrigin.statusCode, 403);
});
