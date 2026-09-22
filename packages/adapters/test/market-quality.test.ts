import assert from "node:assert/strict";
import test from "node:test";
import { FintechMarketQualityValidator } from "../src/analytics/fintech-algorithms/market-quality.js";
import { SyntheticChartProvider } from "../src/market-data/synthetic-chart-provider.js";
import { syntheticInstruments } from "@portfolio-atlas/testing";
const instrument = syntheticInstruments[0]!;
const request = {
  instrumentId: instrument.instrumentId,
  instrumentRevision: 1,
  from: "2026-09-01",
  to: "2026-09-18",
  scenario: "clean" as const,
};
const clock = { now: () => "2026-09-22T10:00:00.000Z" };
const validator = new FintechMarketQualityValidator();
async function fixture(adversarial = false) {
  const reply = await new SyntheticChartProvider(clock).chart(instrument, {
    ...request,
    scenario: adversarial ? "adversarial" : "clean",
  });
  if (reply.status !== "available") throw new Error("Fixture unavailable");
  return reply.data;
}
test("independent candle examples accept exact geometry and preserve zero/missing/negative volume", async () => {
  const clean = await fixture();
  let result = validator.validate(clean, instrument, request, clock.now());
  assert.equal(result.acceptedIndexes.length, 12);
  assert.deepEqual(
    clean.rows[0] && [
      clean.rows[0].open,
      clean.rows[0].high,
      clean.rows[0].low,
      clean.rows[0].close,
    ],
    [100, 102, 99, 101],
  );
  const dirty = await fixture(true);
  result = validator.validate(dirty, instrument, request, clock.now());
  assert.deepEqual(result.acceptedIndexes, [0, 3, 5, 11]);
  assert.ok(result.rows[1]!.findings.some((f) => f.code === "HIGH_BELOW_BODY"));
  assert.equal(dirty.rows[2]!.close, null);
  assert.equal(result.rows.length, 12);
  assert.ok(result.rows[3]!.findings.some((f) => f.code === "ZERO_VOLUME"));
  assert.ok(result.rows[5]!.findings.some((f) => f.code === "MISSING_VOLUME"));
  assert.equal(result.rows[4]!.accepted, false);
  assert.equal(result.rows[6]!.accepted, false);
  assert.ok(result.rows[9]!.findings.some((f) => f.code === "DUPLICATE_SESSION"));
  assert.ok(result.rows[10]!.findings.some((f) => f.code === "DUPLICATE_SESSION"));
  assert.equal(result.coverage.missingSessions[0]?.sessionDate, "2026-09-15");
  assert.equal(result.coverage.missingSessions[0]?.classification, "unknown");
});
test("unknown tick, finality and provider identity never borrow synthetic proof", async () => {
  const data = await fixture();
  const result = validator.validate(
    data,
    { ...instrument, tickSize: null, identityStatus: "provider_observed" },
    request,
    clock.now(),
  );
  assert.equal(result.acceptedIndexes.length, 0);
  assert.ok(result.rows[0]!.findings.some((f) => f.code === "UNKNOWN_TICK"));
  data.rows[0]!.finality = "unknown";
  const unknown = validator.validate(data, instrument, request, clock.now());
  assert.ok(unknown.rows[0]!.findings.some((f) => f.code === "SESSION_UNKNOWN"));
});
test("future, out-of-order and outside-window events cannot enter calculations", async () => {
  const data = await fixture();
  data.rows[0]!.timestamp = "2026-09-23T13:30:00.000Z";
  data.rows[1]!.timestamp = "2026-08-01T13:30:00.000Z";
  const result = validator.validate(data, instrument, request, clock.now());
  assert.ok(result.rows[0]!.findings.some((f) => f.code === "FUTURE_EVENT"));
  assert.ok(result.rows[1]!.findings.some((f) => f.code === "OUTSIDE_WINDOW"));
  assert.ok(result.rows[1]!.findings.some((f) => f.code === "OUT_OF_ORDER"));
});
