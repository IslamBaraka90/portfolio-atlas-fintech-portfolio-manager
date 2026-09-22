import assert from "node:assert/strict";
import test from "node:test";
import { globalMinimumVariance } from "fintech-algorithms/portfolio-construction/mean-risk-optimization/global-minimum-variance";
import { inverseVolatilityWeights } from "fintech-algorithms/portfolio-construction/risk-allocation/inverse-volatility-weighting";

test("0.13.2 contract-tier D14 methods agree with independent two-asset examples", () => {
  // Minimize .04*w² + .04*(1-w)²: derivative .16*w-.08 gives w=.5.
  const equal = globalMinimumVariance(
    ["A", "B"],
    [
      [0.04, 0],
      [0, 0.04],
    ],
  );
  assert.equal(equal.status, "optimal");
  assert.ok(equal.weights);
  assert.ok(Math.abs(equal.weights[0]! - 0.5) < 1e-10);
  assert.ok(Math.abs(equal.variance! - 0.02) < 1e-10);
  // Independent derivative for covariance .01 gives (varianceB-cov)/(varA+varB-2cov)=8/11.
  const unequal = globalMinimumVariance(
    ["A", "B"],
    [
      [0.04, 0.01],
      [0.01, 0.09],
    ],
  );
  assert.equal(unequal.status, "optimal");
  assert.ok(Math.abs(unequal.weights![0]! - 8 / 11) < 1e-8);
  const inverse = inverseVolatilityWeights(["A", "B"], [0.1, 0.2]);
  assert.ok(Math.abs(inverse.weights[0]! - 2 / 3) < 1e-10);
  assert.equal(
    globalMinimumVariance(
      ["A", "B"],
      [
        [1, 2],
        [2, 1],
      ],
    ).status,
    "invalid_input",
  );
});
