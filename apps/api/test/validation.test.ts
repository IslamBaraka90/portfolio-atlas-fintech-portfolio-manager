import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { validationRequestSchema, validationRunSchema } from "@portfolio-atlas/contracts";
import { historicalFixture, fixtureTime } from "@portfolio-atlas/testing";
import { validateStrategy } from "@portfolio-atlas/core";
import { FintechDrawdownEngine } from "@portfolio-atlas/adapters";
test("chronological folds retain reproducible accounting, isolated holdout and future-mutation invariance", () => {
  const request = validationRequestSchema.parse({}),
    fixture = historicalFixture(),
    engine = new FintechDrawdownEngine();
  const result = validateStrategy(fixture, request, engine);
  assert.equal(result.status, "synthetic_experiment");
  assert.equal(result.folds.length, 18);
  assert.deepEqual(result, validateStrategy(fixture, request, engine));
  const future = structuredClone(fixture);
  future.bars.slice(12).forEach((b) => {
    b.closes = b.closes.map((v) => v * 2);
    b.opens = b.opens.map((v) => v * 2);
  });
  const changed = validateStrategy(future, request, engine);
  assert.deepEqual(
    changed.folds.filter((f) => !f.holdout),
    result.folds.filter((f) => !f.holdout),
  );
  assert.deepEqual(
    changed.folds.filter((f) => f.holdout).map((f) => f.fittedScores),
    result.folds.filter((f) => f.holdout).map((f) => f.fittedScores),
  );
  const rolling = validateStrategy(fixture, { ...request, window: "rolling" }, engine);
  assert.equal(rolling.folds.at(-1)!.trainStart, "2026-07-13");
  assert.ok(result.folds.every((f) => f.trainEnd < f.testStart && f.book.book.reconciled));
  for (const scenario of ["late-filing", "missing-session"] as const) {
    const blocked = validateStrategy(historicalFixture(scenario), { ...request, scenario }, engine);
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.folds.length, 0);
  }
  const current = validateStrategy(
    fixture,
    { ...request, dataset: { id: "current", revision: 1 } },
    engine,
  );
  assert.match(current.reasons[0]!, /survivor-safe/);
});
test("validation API persists exact runs, replays commands, and exposes blocked evidence", async (t) => {
  const app = buildApp({ clock: { now: () => fixtureTime } });
  t.after(() => app.close());
  const payload = { scenario: "clean", feeBps: 10 },
    headers = { "idempotency-key": "validation-command-1" };
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/validation-runs",
    payload,
    headers,
  });
  assert.equal(response.statusCode, 201, response.body);
  const result = validationRunSchema.parse(response.json().data);
  assert.equal(result.folds[2]!.fees, "7.92");
  const replay = await app.inject({
    method: "POST",
    url: "/api/v1/validation-runs",
    payload,
    headers,
  });
  assert.deepEqual(replay.json().data, result);
  assert.deepEqual((await app.inject("/api/v1/validation-runs/" + result.id)).json().data, result);
  const blocked = await app.inject({
    method: "POST",
    url: "/api/v1/validation-runs",
    payload: { scenario: "late-filing" },
    headers: { "idempotency-key": "validation-command-2" },
  });
  assert.equal(blocked.statusCode, 201);
  assert.equal(blocked.json().data.status, "blocked");
  assert.equal((await app.inject("/api/v1/validation-runs")).json().data.length, 2);
  const conflict = await app.inject({
    method: "POST",
    url: "/api/v1/validation-runs",
    payload: { feeBps: 20 },
    headers,
  });
  assert.equal(conflict.statusCode, 409);
});
