import assert from "node:assert/strict";
import test from "node:test";
import { ingestionRequestSchema, barObservationSchema } from "../src/market-data.js";
import { lessonBars } from "@portfolio-atlas/testing";
test("daily windows are bounded and nullable source rows survive boundary validation", () => {
  const input = {
    instrumentId: "demo",
    instrumentRevision: 1,
    from: "2026-09-01",
    to: "2026-09-18",
  };
  assert.equal(ingestionRequestSchema.parse(input).scenario, "clean");
  assert.equal(ingestionRequestSchema.safeParse({ ...input, to: input.from }).success, false);
  assert.equal(ingestionRequestSchema.safeParse({ ...input, to: "2028-01-01" }).success, false);
  const row = lessonBars("AURA", true)[2]!;
  assert.equal(barObservationSchema.parse(row).close, null);
});
