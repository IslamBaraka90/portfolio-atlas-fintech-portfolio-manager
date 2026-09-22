import assert from "node:assert/strict";
import test from "node:test";
import { constructionRequestSchema } from "@portfolio-atlas/contracts";
import type { ConstructionInputs } from "@portfolio-atlas/core";
import { FintechConstructionEngine } from "../src/analytics/fintech-algorithms/construction-engine.js";
const engine = new FintechConstructionEngine();
const input: ConstructionInputs = {
  request: constructionRequestSchema.parse({
    portfolioId: "portfolio",
    mandateRevision: 1,
    riskModel: { id: "risk", revision: 1 },
    valuation: { id: "value", revision: 1 },
    method: "minimum_variance",
    cashWeight: 0,
  }),
  assetIds: ["A", "B"],
  annualMeans: [0.1, 0.04],
  annualCovariance: [
    [0.04, 0],
    [0, 0.04],
  ],
  returns: [
    [0.01, 0.02],
    [-0.01, 0.01],
  ],
  currentWeights: [0.6, 0.4, 0],
};
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, a + " != " + b);
test("released D14 optima match independent symmetric/asymmetric solutions and preserve permutation", () => {
  const result = engine.calculate(input);
  assert.equal(result.succeeded, true);
  near(result.weights![0]!, 0.5);
  near(result.variance!, 0.02);
  const asymmetric = {
    ...input,
    annualCovariance: [
      [0.04, 0.01],
      [0.01, 0.09],
    ],
  };
  const solution = engine.calculate(asymmetric);
  near(solution.weights![0]!, 8 / 11);
  const permuted = engine.calculate({
    ...asymmetric,
    assetIds: ["B", "A"],
    annualMeans: [0.04, 0.1],
    annualCovariance: [
      [0.09, 0.01],
      [0.01, 0.04],
    ],
    currentWeights: [0.4, 0.6, 0],
  });
  near(permuted.weights![1]!, solution.weights![0]!);
  near(
    solution.varianceContributions!.reduce((s, v) => s + v, 0),
    solution.variance!,
  );
});
test("baseline and inverse-volatility rules keep explicit cash, and zero volatility cannot be inverted", () => {
  const equal = engine.calculate({
    ...input,
    request: { ...input.request, method: "equal_weight", cashWeight: 0.2 },
  });
  assert.deepEqual(equal.weights, [0.4, 0.4, 0.2]);
  const inverse = engine.calculate({
    ...input,
    request: { ...input.request, method: "inverse_volatility" },
    annualCovariance: [
      [0.01, 0],
      [0, 0.04],
    ],
  });
  near(inverse.weights![0]!, 2 / 3);
  assert.equal(
    engine.calculate({
      ...input,
      request: { ...input.request, method: "inverse_volatility" },
      annualCovariance: [
        [0, 0],
        [0, 0.04],
      ],
    }).succeeded,
    false,
  );
});
test("iteration exhaustion and indefinite covariance never become successful proposals", () => {
  const exhausted = engine.calculate({
    ...input,
    request: { ...input.request, maxIterations: 0 },
    annualCovariance: [
      [0.04, 0.01],
      [0.01, 0.09],
    ],
  });
  assert.equal(exhausted.succeeded, false);
  assert.equal(exhausted.solver.status, "numerical_issue");
  assert.equal(
    engine.calculate({
      ...input,
      annualCovariance: [
        [1, 2],
        [2, 1],
      ],
    }).succeeded,
    false,
  );
});

test("released turnover solver reaches the independent 0.7 boundary and never certifies exhausted iterations", () => {
  const calculation = {
    ...input,
    annualCovariance: [
      [0.04, 0],
      [0, 0.01],
    ],
    request: { ...input.request, method: "turnover_constrained" as const, turnoverCap: 0.1 },
  };
  const result = engine.calculate(calculation);
  assert.equal(result.succeeded, true);
  near(result.weights![0]!, 0.7);
  near(result.weights![1]!, 0.3);
  near(result.weights![2]!, 0);
  assert.equal(result.solver.status, "optimal");
  assert.ok(result.solver.gap! < 1e-8);
  const stopped = engine.calculate({
    ...calculation,
    request: { ...calculation.request, maxIterations: 1 },
  });
  assert.equal(stopped.succeeded, false);
  assert.equal(stopped.solver.status, "max-iterations");
});
