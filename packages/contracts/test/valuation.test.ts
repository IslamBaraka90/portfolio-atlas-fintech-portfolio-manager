import assert from "node:assert/strict";
import test from "node:test";
import { valuationRequestSchema, benchmarkDefinitionInputSchema } from "../src/index.js";
test("valuation requires explicit immutable mark references and duplicate selections fail", () => {
  const p = {
    instrumentId: "A",
    dataset: { id: "data", revision: 1 },
    rowId: "row",
    reviewId: "review",
  };
  const base = { portfolioId: "p", checkpoint: 2, asOf: "2026-09-22T12:00:00Z", prices: [p] };
  assert.equal(valuationRequestSchema.parse(base).maxPriceAgeSeconds, 864000);
  assert.equal(valuationRequestSchema.safeParse({ ...base, prices: [p, p] }).success, false);
  assert.equal(
    valuationRequestSchema.safeParse({
      ...base,
      overrides: [
        {
          instrumentId: "A",
          currency: "USD",
          price: 110,
          quotedAt: base.asOf,
          reason: "Authored teaching mark",
          sourceRef: "lesson",
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    benchmarkDefinitionInputSchema.safeParse({
      name: "Lesson",
      currency: "USD",
      returnBasis: "net_total_return",
      adjustmentRuns: [{ id: "run", revision: 1 }],
    }).success,
    false,
  );
});
