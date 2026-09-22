import { inspectCovariance } from "@portfolio-atlas/core";
import { z } from "zod";
import { simpleReturn } from "fintech-algorithms/foundations/financial-arithmetic-time-value-and-returns/simple-return";
import { logReturn } from "fintech-algorithms/foundations/financial-arithmetic-time-value-and-returns/log-return";
import { arithmeticMean } from "fintech-algorithms/foundations/location-ranking-and-exploratory-summaries/arithmetic-mean";
import { calculate as sample } from "fintech-algorithms/volatility-and-covariance/covariance-estimation/sample-covariance";
import { calculate as ewma } from "fintech-algorithms/volatility-and-covariance/covariance-estimation/ewma-covariance";
import { calculate as shrinkage } from "fintech-algorithms/volatility-and-covariance/covariance-estimation/ledoit-wolf-shrinkage";
import type { RiskModelRequest } from "@portfolio-atlas/contracts";
import type { RiskEngine, RiskCalculation, BenchmarkSource } from "@portfolio-atlas/core";
const finite = z.number().finite();
const outputSchema = z.object({
  ready: z.literal(true),
  matrix: z.array(z.array(finite)),
  diagnostics: z.object({
    observations: z.number().int(),
    assets: z.number().int(),
    denominator: finite.optional(),
    shrinkage: finite.optional(),
    weight_mass: finite.optional(),
    seed_weight: finite.optional(),
  }),
});
export function estimateRisk(returns: number[][], request: RiskModelRequest) {
  const input = {
    returns,
    parameters: request.estimator === "ewma" ? { decay: request.decay } : {},
  };
  const output = outputSchema.parse(
    request.estimator === "sample"
      ? sample(input)
      : request.estimator === "ewma"
        ? ewma(input)
        : shrinkage(input),
  );
  if (
    output.diagnostics.observations !== returns.length ||
    output.diagnostics.assets !== returns[0]?.length
  )
    throw new Error("Estimator changed the sample dimensions.");
  const dailyMeans = returns[0]!.map(
    (_, j) =>
      z.object({ mean: finite }).parse(arithmeticMean({ values: returns.map((r) => r[j]!) })).mean,
  );
  return {
    dailyMeans,
    covarianceDaily: output.matrix,
    covarianceAnnual: output.matrix.map((row) => row.map((v) => v * request.annualization)),
    estimatorDetails: {
      centering:
        request.estimator === "ewma" ? "zero_mean_assumption_zero_seed" : "sample_column_means",
      denominator:
        output.diagnostics.denominator ??
        (request.estimator === "ledoit_wolf" ? returns.length : null),
      shrinkage: output.diagnostics.shrinkage ?? null,
      weightMass: output.diagnostics.weight_mass ?? null,
      seedWeight: output.diagnostics.seed_weight ?? null,
    },
  };
}
export class FintechRiskEngine implements RiskEngine {
  calculate(request: RiskModelRequest, sources: BenchmarkSource[]): RiskCalculation {
    const result: RiskCalculation = {
      status: "unavailable",
      reasons: [],
      warnings: [
        "Current research history is not point-in-time strategy evidence.",
        "Annualization assumes the selected daily scaling; serial dependence can invalidate that scaling.",
        "Expected returns are assumptions, not guaranteed forecasts.",
        "A short authored sample demonstrates mechanics, not reliable investment estimation.",
      ],
      assets: sources.map(({ dataset, run }) => ({
        instrumentId: dataset.instrument.instrumentId,
        symbol: dataset.instrument.returnedSymbol,
        dataset: { id: dataset.id, revision: dataset.revision },
        adjustmentRun: { id: run.id, revision: run.revision },
        sourceHash: dataset.sourceHash,
        currency: run.sourceCurrency,
      })),
      currency: sources[0]?.run.sourceCurrency ?? null,
      frequency: "daily",
      missingPolicy: "reject_incomplete_aligned_sample",
      availability: "current_research_not_point_in_time",
      intervals: [],
      returns: [],
      dailyMeans: [],
      annualExpectedReturns: [],
      covarianceDaily: [],
      covarianceAnnual: [],
      correlation: [],
      volatilityAnnual: [],
      observations: 0,
      diagnostics: null,
      estimatorDetails: {
        centering: "unavailable",
        denominator: null,
        shrinkage: null,
        weightMass: null,
        seedWeight: null,
      },
      packageVersion: "0.13.2",
      verification: "verified_shared_fixture_parity",
      policyVersion: "chapter-8.v1",
    };
    const reject = (reason: string) => {
      result.reasons.push(reason);
      return result;
    };
    if (
      sources.length < 2 ||
      sources.length > 8 ||
      sources.length !== request.adjustmentRuns.length
    )
      return reject("Supply two to eight matching histories.");
    const ids = result.assets.map((a) => a.instrumentId);
    if (new Set(ids).size !== ids.length)
      return reject("Each ordered instrument must occur exactly once.");
    if (
      sources.some(
        ({ dataset, run }) =>
          run.status !== "ready" ||
          run.datasetId !== dataset.id ||
          run.datasetRevision !== dataset.revision ||
          run.sourceHash !== dataset.sourceHash,
      )
    )
      return reject("Every adjustment must match its ready immutable source revision and hash.");
    if (
      sources.some(
        ({ dataset, run }) =>
          dataset.source !== "synthetic" ||
          dataset.basis !== "synthetic_unadjusted" ||
          !["equity", "etf"].includes(dataset.instrument.assetType) ||
          Date.parse(dataset.observedAt) > Date.parse(request.asOf) ||
          Date.parse(run.createdAt) > Date.parse(request.asOf) ||
          Date.parse(run.actionKnowledgeAt) > Date.parse(request.asOf),
      )
    )
      return reject("Source basis, asset type or evidence cutoff is unsupported.");
    if (!result.currency || sources.some(({ run }) => run.sourceCurrency !== result.currency))
      return reject("Use same-currency histories; historical FX risk has not been supplied.");
    if (
      sources.some(
        ({ dataset }) => dataset.timezone !== sources[0]!.dataset.timezone || !dataset.timezone,
      )
    )
      return reject("Daily session timezones must match and be known.");
    if (
      sources.some(
        ({ dataset, run }) =>
          dataset.quality.coverage.expectedSessions === null ||
          dataset.quality.coverage.missingSessions.length ||
          dataset.quality.quarantinedIndexes.length ||
          dataset.quality.acceptedIndexes.length !== dataset.rows.length ||
          run.series.length !== dataset.rows.length,
      )
    )
      return reject("Incomplete sessions cannot be compressed or deleted pairwise.");
    const dates = sources[0]!.run.series.map((r) => r.date);
    if (dates.length < 3 || dates.some((d, i) => i > 0 && d <= dates[i - 1]!))
      return reject("At least three strictly ordered daily price observations are required.");
    if (
      sources.some(
        ({ run, dataset }) =>
          JSON.stringify(run.series.map((r) => r.date)) !== JSON.stringify(dates) ||
          run.series.some(
            (r, i) =>
              r.sourceRowId !== dataset.rows[i]?.rowId ||
              r.date !== dataset.rows[i]?.sessionDate ||
              !dataset.rows[i]?.timestamp ||
              Date.parse(dataset.rows[i]!.timestamp!) > Date.parse(request.asOf),
          ),
      )
    )
      return reject("Asset sessions or source rows are not exactly aligned at the cutoff.");
    if (
      request.expectedReturnAssumption === "scenario" &&
      (request.annualExpectedReturns.length !== ids.length ||
        new Set(request.annualExpectedReturns.map((v) => v.instrumentId)).size !== ids.length ||
        request.annualExpectedReturns.some((v) => !ids.includes(v.instrumentId)))
    )
      return reject("Scenario assumptions must name every asset exactly once.");
    const columns = sources.map(({ run }) =>
      run.series.map((r) =>
        request.returnBasis === "price" ? r.splitAdjustedClose : r.totalReturnClose,
      ),
    );
    if (columns.some((prices) => prices.some((p) => !Number.isFinite(p) || p <= 0 || p > 1e12)))
      return reject("Prices exceed the finite positive analysis boundary.");
    try {
      result.intervals = dates.slice(1).map((to, i) => ({ from: dates[i]!, to }));
      result.returns = dates.slice(1).map((_, i) =>
        columns.map((prices) => {
          const input = {
            principal: 0,
            rate: 0,
            periods: 1,
            startValue: prices[i]!,
            endValue: prices[i + 1]!,
          };
          return request.returnType === "simple"
            ? z.object({ simpleReturn: finite }).parse(simpleReturn(input)).simpleReturn
            : z.object({ logReturn: finite }).parse(logReturn(input)).logReturn;
        }),
      );
      result.observations = result.returns.length;
      Object.assign(result, estimateRisk(result.returns, request));
      result.annualExpectedReturns = ids.map((id, i) =>
        request.expectedReturnAssumption === "zero"
          ? 0
          : request.expectedReturnAssumption === "historical_mean"
            ? result.dailyMeans[i]! * request.annualization
            : request.annualExpectedReturns.find((v) => v.instrumentId === id)!.annualReturn,
      );
      if (result.observations <= ids.length)
        result.warnings.push(
          "Observations do not exceed assets; sample covariance cannot be full rank.",
        );
      result.diagnostics = inspectCovariance(result.covarianceDaily, ids.length);
      if (!result.diagnostics.valid) return reject(result.diagnostics.reasons.join(" "));
      result.volatilityAnnual = result.covarianceAnnual.map((row, i) => Math.sqrt(row[i]!));
      result.correlation = result.covarianceDaily.map((row, i) =>
        row.map((v, j) => {
          const a = result.covarianceDaily[i]![i]!,
            b = result.covarianceDaily[j]![j]!;
          return a <= result.diagnostics!.tolerance || b <= result.diagnostics!.tolerance
            ? null
            : Math.max(-1, Math.min(1, v / Math.sqrt(a * b)));
        }),
      );
      result.warnings.push(...result.diagnostics.reasons);
      if (result.correlation.some((row) => row.some((v) => v === null)))
        result.warnings.push("Zero or numerically zero variance makes correlation undefined.");
      result.status = "ready";
      return result;
    } catch (error) {
      return reject(error instanceof Error ? error.message : "Risk estimation failed.");
    }
  }
}
