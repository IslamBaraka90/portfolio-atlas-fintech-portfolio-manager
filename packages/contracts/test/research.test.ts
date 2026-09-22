import assert from "node:assert/strict";
import test from "node:test";
import { companyPeriodSchema, companyRequestSchema, researchRequestSchema } from "../src/index.js";
test("research separates period end from availability and preserves zero or missing statement values", () => {
  const period = companyPeriodSchema.parse({
    periodEnd: "2025-12-31",
    periodType: "12M",
    revision: 1,
    currency: "USD",
    availableAt: "2026-09-22T00:00:00Z",
    availabilityBasis: "observed_now",
    sourceRef: "provider",
    items: { revenue: 0, costOfRevenue: null, grossProfit: 0, netIncome: -10 },
    reasons: [],
  });
  assert.equal(period.items.revenue, 0);
  assert.equal(period.items.costOfRevenue, null);
  assert.notEqual(period.periodEnd, period.availableAt.slice(0, 10));
  assert.equal(
    companyRequestSchema.safeParse({
      instrumentId: "A",
      instrumentRevision: 1,
      from: "2026-01-01",
      to: "2025-01-01",
    }).success,
    false,
  );
  assert.equal(
    researchRequestSchema.safeParse({
      series: [{ dataset: { id: "d", revision: 1 } }],
      asOf: period.availableAt,
      window: 1,
    }).success,
    false,
  );
});
