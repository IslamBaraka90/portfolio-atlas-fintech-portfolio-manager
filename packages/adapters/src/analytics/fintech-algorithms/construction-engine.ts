import { z } from "zod";
import { calculate as equalWeight } from "fintech-algorithms/index-and-benchmark-engineering/weighting-and-capping/equal-weight-index";
import { globalMinimumVariance } from "fintech-algorithms/portfolio-construction/mean-risk-optimization/global-minimum-variance";
import { inverseVolatilityWeights } from "fintech-algorithms/portfolio-construction/risk-allocation/inverse-volatility-weighting";
import { covarianceMatricesPortfolioVarianceAndDiversification as portfolioRisk } from "fintech-algorithms/foundations/financial-risk-and-performance-statistics/covariance-matrices-portfolio-variance-and-diversification";
import {
  inspectCovariance,
  type ConstructionInputs,
  type ConstructionEngine,
  type ConstructionCalculation,
} from "@portfolio-atlas/core";
const finite = z.number().finite();
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
// Some numerical diagnostics can be nonfinite. Name them explicitly rather than
// letting JSON serialization silently change Infinity into a misleading null.
function evidence(value: unknown): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(value, (_key, v: unknown) =>
      typeof v === "number" && !Number.isFinite(v) ? "nonfinite:" + String(v) : v,
    ),
  ) as Record<string, unknown>;
}
export class FintechConstructionEngine implements ConstructionEngine {
  calculate(input: ConstructionInputs): ConstructionCalculation {
    const { request, assetIds, annualMeans, annualCovariance } = input;
    const result: ConstructionCalculation = {
      succeeded: false,
      weights: null,
      variance: null,
      volatility: null,
      expectedReturn: null,
      varianceContributions: null,
      riskShares: null,
      solver: {
        status: "unsupported",
        method: request.method,
        iterations: 0,
        solutionClass: null,
        objective: null,
        gap: null,
        budgetResidual: null,
        details: {},
        warnings: [],
      },
    };
    try {
      const diagnostic = inspectCovariance(annualCovariance, assetIds.length);
      if (
        !diagnostic.valid ||
        annualMeans.length !== assetIds.length ||
        new Set(assetIds).size !== assetIds.length
      )
        throw new Error(
          "Construction inputs require unique ordered IDs, matching means and a valid PSD matrix.",
        );
      let risky: number[];
      if (request.method === "equal_weight") {
        risky = z
          .object({ weights: z.array(finite) })
          .parse(equalWeight({ ids: assetIds, returns: assetIds.map(() => 0) })).weights;
        result.solver.status = "baseline";
        result.solver.method = "equal-risky-capital";
        result.solver.solutionClass = "deterministic_rule";
      } else if (request.method === "minimum_variance") {
        const solved = globalMinimumVariance(assetIds, annualCovariance, {
          mu: annualMeans,
          returnHorizon: "annual",
          maxIterations: request.maxIterations,
        });
        result.solver = {
          status: solved.status,
          method: solved.method,
          iterations: solved.iterations,
          solutionClass: solved.solutionClass,
          objective: solved.variance,
          gap: solved.fwGap,
          budgetResidual: solved.budgetResidual,
          details: evidence(solved.diagnostics),
          warnings: solved.warnings,
        };
        if (solved.status !== "optimal" || !solved.weights) return result;
        risky = solved.weights;
      } else if (request.method === "inverse_volatility") {
        const solved = inverseVolatilityWeights(
          assetIds,
          annualCovariance.map((r, i) => Math.sqrt(r[i]!)),
        );
        risky = solved.weights;
        result.solver.status = solved.status;
        result.solver.method = solved.method;
        result.solver.solutionClass = "deterministic_rule";
        result.solver.details = { normalizedScores: solved.normalizedInverseVolatilityScores };
      } else {
        result.solver.warnings.push(
          "Turnover optimization joins the practical-constraints checkpoint.",
        );
        return result;
      }
      if (
        risky.length !== assetIds.length ||
        risky.some((v) => !Number.isFinite(v) || v < 0) ||
        Math.abs(sum(risky) - 1) > 1e-12
      )
        throw new Error("Package weights failed the ordered simplex boundary.");
      const weights = [...risky.map((v) => v * (1 - request.cashWeight)), request.cashWeight];
      const covariance = [
        ...annualCovariance.map((row) => [...row, 0]),
        assetIds.map(() => 0).concat(0),
      ];
      const risks = z.object({ portfolioVariance: finite, portfolioVolatility: finite }).parse(
        portfolioRisk({
          weights,
          covarianceMatrix: covariance,
          returns: input.returns.map((row) => sum(row.map((v, i) => v * weights[i]!))),
          benchmark: input.returns.map((row) => row[0]!),
          frequency: 1,
          confidence: 0.95,
          target: 0,
          riskFree: 0,
        }),
      );
      const contributions = weights.map(
        (w, i) => w * sum(covariance[i]!.map((v, j) => v * weights[j]!)),
      );
      if (
        Math.abs(sum(contributions) - risks.portfolioVariance) >
        Math.max(1e-12, risks.portfolioVariance * 1e-10)
      )
        throw new Error("Variance contributions do not reconcile.");
      result.weights = weights;
      result.variance = risks.portfolioVariance;
      result.volatility = risks.portfolioVolatility;
      result.expectedReturn = sum(annualMeans.map((mu, i) => mu * weights[i]!));
      result.varianceContributions = contributions;
      result.riskShares = contributions.map((v) =>
        risks.portfolioVariance > 0 ? v / risks.portfolioVariance : null,
      );
      result.solver.budgetResidual = Math.abs(sum(weights) - 1);
      result.succeeded = true;
      return result;
    } catch (error) {
      result.solver.status = "invalid_or_numerical";
      result.solver.warnings.push(error instanceof Error ? error.message : "Construction failed.");
      return result;
    }
  }
}
