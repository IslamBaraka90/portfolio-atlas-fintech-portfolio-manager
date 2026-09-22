import assert from "node:assert/strict";
import test from "node:test";
import { riskModelRequestSchema } from "@portfolio-atlas/contracts";
import { estimateRisk } from "../src/analytics/fintech-algorithms/risk-engine.js";
const request = riskModelRequestSchema.parse({
  adjustmentRuns: [
    { id: "a", revision: 1 },
    { id: "b", revision: 1 },
  ],
  asOf: "2026-09-22T12:00:00Z",
});
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, a + " != " + b);
test("independent sample covariance uses aligned columns and n-1, with explicit annual scaling", () => {
  const output = estimateRisk(
    [
      [0.1, 0],
      [-0.1, 0.1],
      [0, -0.1],
    ],
    request,
  );
  assert.deepEqual(output.dailyMeans, [0, 0]);
  near(output.covarianceDaily[0]![0]!, 0.01);
  near(output.covarianceDaily[0]![1]!, -0.005);
  near(output.covarianceAnnual[1]![1]!, 2.52);
  assert.equal(output.estimatorDetails.denominator, 2);
});
test("EWMA preserves finite-window weight mass and zero seed instead of silently normalizing", () => {
  const output = estimateRisk(
    [
      [0.01, 0.02],
      [-0.02, 0.01],
    ],
    { ...request, estimator: "ewma", decay: 0.5 },
  );
  near(output.covarianceDaily[0]![0]!, 0.000225);
  near(output.covarianceDaily[0]![1]!, -0.00005);
  near(output.covarianceDaily[1]![1]!, 0.00015);
  assert.equal(output.estimatorDetails.weightMass, 0.75);
  assert.equal(output.estimatorDetails.seedWeight, 0.25);
});
test("shrinkage uses scaled identity and retains its estimated coefficient", () => {
  const output = estimateRisk(
    [
      [0.1, 0],
      [-0.1, 0.1],
      [0, -0.1],
    ],
    { ...request, estimator: "ledoit_wolf" },
  );
  assert.equal(output.estimatorDetails.denominator, 3);
  assert.equal(output.estimatorDetails.shrinkage, 1);
  near(output.covarianceDaily[0]![0]!, 2 / 300);
  near(output.covarianceDaily[0]![1]!, 0);
});
