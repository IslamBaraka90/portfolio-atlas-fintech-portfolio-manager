import type { MatrixDiagnostics } from "@portfolio-atlas/contracts";
/** A bounded symmetric Jacobi decomposition for the small teaching universe.
 * It diagnoses the supplied matrix; it never substitutes a repaired covariance.
 */
export function inspectCovariance(matrix: number[][], dimension: number): MatrixDiagnostics {
  const result: MatrixDiagnostics = {
    valid: false,
    symmetric: false,
    positiveSemidefinite: false,
    positiveDefinite: false,
    rank: 0,
    dimension,
    tolerance: 0,
    eigenvalues: [],
    conditionNumber: null,
    reasons: [],
  };
  const reject = (reason: string) => {
    result.reasons.push(reason);
    return result;
  };
  if (
    !Number.isInteger(dimension) ||
    dimension < 1 ||
    dimension > 8 ||
    matrix.length !== dimension ||
    matrix.some((row) => row.length !== dimension)
  )
    return reject("Covariance dimensions must match the ordered universe (one to eight assets).");
  if (matrix.some((row) => row.some((v) => !Number.isFinite(v))))
    return reject("Covariance contains a nonfinite cell.");
  const scale = Math.max(...matrix.flat().map(Math.abs));
  result.tolerance = Math.max(1e-14, scale * 1e-10);
  if (matrix.some((row, i) => row.some((v, j) => Math.abs(v - matrix[j]![i]!) > result.tolerance)))
    return reject("Covariance is not symmetric within tolerance.");
  result.symmetric = true;
  if (matrix.some((row, i) => row[i]! < 0)) return reject("Covariance has a negative variance.");
  // Use the symmetric part only for numerical diagnosis within the declared tolerance.
  const work = matrix.map((row, i) => row.map((v, j) => (v + matrix[j]![i]!) / 2));
  let converged = dimension === 1;
  for (let iteration = 0; iteration < 100 * dimension * dimension; iteration++) {
    let p = 0,
      q = 0,
      largest = 0;
    for (let i = 0; i < dimension; i++)
      for (let j = i + 1; j < dimension; j++)
        if (Math.abs(work[i]![j]!) > largest) {
          largest = Math.abs(work[i]![j]!);
          p = i;
          q = j;
        }
    if (largest <= result.tolerance / dimension) {
      converged = true;
      break;
    }
    const off = work[p]![q]!,
      tau = (work[q]![q]! - work[p]![p]!) / (2 * off);
    const t = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau)),
      c = 1 / Math.sqrt(1 + t * t),
      s = t * c;
    work[p]![p] = work[p]![p]! - t * off;
    work[q]![q] = work[q]![q]! + t * off;
    work[p]![q] = 0;
    work[q]![p] = 0;
    for (let k = 0; k < dimension; k++) {
      if (k === p || k === q) continue;
      const kp = work[k]![p]!,
        kq = work[k]![q]!;
      work[k]![p] = work[p]![k] = c * kp - s * kq;
      work[k]![q] = work[q]![k] = s * kp + c * kq;
    }
  }
  if (!converged)
    return reject("Matrix diagnostic did not converge within its bounded iteration budget.");
  result.eigenvalues = work.map((row, i) => row[i]!).sort((a, b) => a - b);
  if (result.eigenvalues.some((v) => !Number.isFinite(v)))
    return reject("Eigenvalue calculation was nonfinite.");
  result.rank = result.eigenvalues.filter((v) => v > result.tolerance).length;
  result.positiveSemidefinite = result.eigenvalues[0]! >= -result.tolerance;
  result.positiveDefinite = result.eigenvalues[0]! > result.tolerance;
  if (!result.positiveSemidefinite)
    return reject("Covariance is indefinite; no repair was applied.");
  result.valid = true;
  result.conditionNumber = result.positiveDefinite
    ? result.eigenvalues.at(-1)! / result.eigenvalues[0]!
    : null;
  if (!result.positiveDefinite)
    result.reasons.push(
      "Singular or numerically singular PSD estimate; inversion is not supported.",
    );
  return result;
}
