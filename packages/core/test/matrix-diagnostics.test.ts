import assert from "node:assert/strict";
import test from "node:test";
import { inspectCovariance } from "../src/domain/risk/matrix-diagnostics.js";
test("matrix diagnostic distinguishes positive definite, singular, constant and indefinite examples", () => {
  const pd = inspectCovariance(
    [
      [0.01, -0.005],
      [-0.005, 0.01],
    ],
    2,
  );
  assert.equal(pd.valid, true);
  assert.equal(pd.positiveDefinite, true);
  assert.equal(pd.rank, 2);
  assert.ok(Math.abs(pd.eigenvalues[0]! - 0.005) < 1e-12);
  assert.ok(Math.abs(pd.conditionNumber! - 3) < 1e-12);
  const singular = inspectCovariance(
    [
      [0.01, 0.01],
      [0.01, 0.01],
    ],
    2,
  );
  assert.equal(singular.valid, true);
  assert.equal(singular.positiveDefinite, false);
  assert.equal(singular.rank, 1);
  assert.equal(
    inspectCovariance(
      [
        [0, 0],
        [0, 0],
      ],
      2,
    ).rank,
    0,
  );
  assert.equal(
    inspectCovariance(
      [
        [1, 2],
        [2, 1],
      ],
      2,
    ).valid,
    false,
  );
});
test("shape, symmetry, negative variance and finite-value failures cannot be repaired silently", () => {
  for (const matrix of [
    [[1, 0]],
    [
      [1, 2],
      [1, 1],
    ],
    [
      [1, 0],
      [0, -1e-20],
    ],
    [
      [1, NaN],
      [NaN, 1],
    ],
  ])
    assert.equal(inspectCovariance(matrix, 2).valid, false);
  const covariance = [
    [2, 1, 0],
    [1, 2, 0],
    [0, 0, 5],
  ];
  const result = inspectCovariance(covariance, 3);
  assert.deepEqual(result.eigenvalues, [1, 3, 5]);
  assert.deepEqual(covariance, [
    [2, 1, 0],
    [1, 2, 0],
    [0, 0, 5],
  ]);
});
