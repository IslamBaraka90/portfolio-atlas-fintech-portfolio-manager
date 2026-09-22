import assert from "node:assert/strict";
import test from "node:test";
import { fxObservationSchema, corporateActionSchema } from "../src/corporate-actions.js";
test("action and FX contracts require explicit ratio direction, clocks and finite positive terms", () => {
  const fx = {
    id: "demo",
    baseCurrency: "USD",
    quoteCurrency: "EUR",
    quotePerBase: 0.9,
    observedAt: "2026-09-17T21:00:00Z",
    availableAt: "2026-09-17T21:00:00Z",
    source: "authored",
    maxAgeSeconds: 86400,
  };
  assert.equal(fxObservationSchema.parse(fx).quotePerBase, 0.9);
  assert.equal(fxObservationSchema.safeParse({ ...fx, quotePerBase: 0 }).success, false);
  assert.equal(corporateActionSchema.safeParse({ id: "incomplete" }).success, false);
});
