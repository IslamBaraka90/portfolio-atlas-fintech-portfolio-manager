import assert from "node:assert/strict";
import test from "node:test";
import { convertFx } from "../src/domain/convert-fx.js";
const fx = {
  id: "fixture",
  baseCurrency: "USD",
  quoteCurrency: "EUR",
  quotePerBase: 0.9,
  observedAt: "2026-09-22T10:00:00Z",
  availableAt: "2026-09-22T10:00:00Z",
  source: "authored",
  maxAgeSeconds: 3600,
};
test("FX direction is explicit, reciprocal and bounded by available-time freshness", () => {
  assert.equal(convertFx(100, "USD", "EUR", fx, "2026-09-22T10:30:00Z"), 90);
  assert.equal(convertFx(90, "EUR", "USD", fx, "2026-09-22T10:30:00Z"), 100);
  assert.throws(() => convertFx(100, "GBP", "EUR", fx, "2026-09-22T10:30:00Z"), /direction/);
  assert.throws(() => convertFx(100, "USD", "EUR", fx, "2026-09-22T12:00:01Z"), /freshness/);
  assert.throws(() => convertFx(100, "USD", "EUR", fx, "2026-09-22T09:59:00Z"), /available/);
  assert.throws(() =>
    convertFx(100, "USD", "EUR", { ...fx, quotePerBase: 0 }, "2026-09-22T10:30:00Z"),
  );
});
