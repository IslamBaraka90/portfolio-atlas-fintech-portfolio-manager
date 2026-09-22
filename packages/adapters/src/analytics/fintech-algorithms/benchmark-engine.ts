import { z } from "zod";
import { calculate as equalWeight } from "fintech-algorithms/index-and-benchmark-engineering/weighting-and-capping/equal-weight-index";
import { calculate as priceReturn } from "fintech-algorithms/index-and-benchmark-engineering/return-variants/price-return-index";
import { calculate as grossReturn } from "fintech-algorithms/index-and-benchmark-engineering/return-variants/gross-total-return-index";
import { simpleReturn } from "fintech-algorithms/foundations/financial-arithmetic-time-value-and-returns/simple-return";
import type { BenchmarkDefinition } from "@portfolio-atlas/contracts";
import type { BenchmarkCalculation, BenchmarkEngine, BenchmarkSource } from "@portfolio-atlas/core";
const levelsSchema = z.object({
  returns: z.array(z.number().finite()),
  levels: z.array(z.number().finite().positive()),
  endingLevel: z.number().finite().positive(),
});
const weightsSchema = z.object({
  ids: z.array(z.string()),
  weights: z.array(z.number().finite()),
  portfolioReturn: z.number().finite(),
});
function fromStart(start: number, end: number) {
  return z
    .object({ simpleReturn: z.number().finite() })
    .parse(simpleReturn({ principal: 0, rate: 0, periods: 1, startValue: start, endValue: end }))
    .simpleReturn;
}
export class FintechBenchmarkEngine implements BenchmarkEngine {
  calculate(definition: BenchmarkDefinition, sources: BenchmarkSource[]): BenchmarkCalculation {
    const result: BenchmarkCalculation = {
      status: "unsupported",
      reasons: [],
      warnings: [
        "Current reconstructed synthetic history; not a point-in-time investable index.",
        "Equal weight at the first session, then buy and hold. No daily reset.",
        "Package values use six-place rounding; verified tier denotes shared-fixture parity.",
      ],
      constituents: [],
      series: [],
      totalReturn: null,
      packageVersion: "0.13.2",
      verification: "verified_shared_fixture_parity",
    };
    const reject = (reason: string) => {
      result.reasons.push(reason);
      return result;
    };
    if (!sources.length || sources.length !== definition.input.adjustmentRuns.length)
      return reject("Constituent sources are missing.");
    const ids = sources.map((s) => s.dataset.instrument.instrumentId);
    if (new Set(ids).size !== ids.length)
      return reject("A listing cannot appear twice in one benchmark.");
    const dates = sources[0]!.run.series.map((row) => row.date);
    if (dates.length < 2) return reject("At least two aligned price sessions are required.");
    if (
      sources.some(
        ({ run, dataset }) =>
          run.status !== "ready" ||
          dataset.source !== "synthetic" ||
          run.sourceCurrency !== definition.input.currency ||
          run.datasetId !== dataset.id ||
          run.datasetRevision !== dataset.revision ||
          run.sourceHash !== dataset.sourceHash,
      )
    )
      return reject("Every constituent needs a ready, same-currency, reviewed synthetic history.");
    if (
      sources.some(
        ({ run }) => JSON.stringify(run.series.map((r) => r.date)) !== JSON.stringify(dates),
      )
    )
      return reject(
        "Constituent dates differ; no time compression or pairwise deletion is allowed.",
      );
    if (sources.some(({ run }) => run.selectedActions.some((a) => a.status !== "confirmed")))
      return reject("Corporate-action terms are not confirmed.");
    try {
      const constituentLevels = sources.map(({ run }) => {
        const prices = run.series.map((row) => row.splitAdjustedClose);
        if (prices.some((p) => !Number.isFinite(p) || p <= 0 || p > 1e12))
          throw new Error("Prices exceed the finite positive benchmark boundary.");
        const dividends = dates.map((date) =>
          run.selectedActions
            .filter((a) => a.kind === "cash_dividend" && a.effectiveDate === date)
            .reduce((sum, a) => {
              if (a.amount === null || a.currency !== definition.input.currency)
                throw new Error("Dividend amount or currency is unknown.");
              if (
                run.selectedActions.some(
                  (split) =>
                    split.kind === "split" &&
                    split.effectiveDate !== null &&
                    split.effectiveDate > date,
                )
              )
                throw new Error(
                  "A later split requires dividend-unit restatement outside this timeline.",
                );
              return sum + a.amount;
            }, 0),
        );
        const calculated = levelsSchema.parse(
          definition.input.returnBasis === "price"
            ? priceReturn({ prices, baseLevel: 1000 })
            : grossReturn({ prices, dividends, baseLevel: 1000 }),
        );
        if (
          calculated.levels.length !== dates.length ||
          calculated.returns.length !== dates.length - 1
        )
          throw new Error("Package output lost date alignment.");
        return calculated.levels;
      });
      const weights = weightsSchema.parse(equalWeight({ ids, returns: ids.map(() => 0) })).weights;
      result.constituents = sources.map(({ run, dataset }, i) => ({
        instrumentId: ids[i]!,
        adjustmentRun: { id: run.id, revision: run.revision },
        dataset: { id: dataset.id, revision: dataset.revision },
        sourceHash: dataset.sourceHash,
        initialWeight: weights[i]!,
      }));
      result.series = dates.map((date, index) => {
        // Applying initial weights to cumulative constituent growth preserves drift;
        // applying them independently to each daily return would reset the portfolio.
        const cumulative = constituentLevels.map((levels) => fromStart(levels[0]!, levels[index]!));
        const total = weightsSchema.parse(
          equalWeight({ ids, returns: cumulative }),
        ).portfolioReturn;
        return { date, level: 1000 * (1 + total), returnFromStart: total };
      });
      result.totalReturn = fromStart(result.series[0]!.level, result.series.at(-1)!.level);
      result.status = "ready";
      return result;
    } catch (error) {
      result.constituents = [];
      result.series = [];
      result.totalReturn = null;
      return reject(error instanceof Error ? error.message : "Benchmark calculation failed.");
    }
  }
}
