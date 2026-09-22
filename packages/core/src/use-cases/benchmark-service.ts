import {
  benchmarkDefinitionInputSchema,
  benchmarkDefinitionSchema,
  benchmarkResultSchema,
  benchmarkComparisonSchema,
  type BenchmarkDefinitionInput,
  type BenchmarkResult,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { BenchmarkEngine } from "../ports/benchmark-engine.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { AdjustmentService } from "./adjustment-service.js";
import type { MarketDataService } from "./market-data-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
export function compareBenchmark(
  result: BenchmarkResult,
  basis: "price" | "gross_total_return",
  currency: string,
) {
  const reasons: string[] = [];
  if (result.status !== "ready") reasons.push("Benchmark calculation is unavailable.");
  if (result.definition.input.returnBasis !== basis)
    reasons.push(
      "Return conventions differ: price and gross total return cannot be silently compared.",
    );
  if (result.definition.input.currency !== currency)
    reasons.push("Benchmark and requested currencies differ.");
  return benchmarkComparisonSchema.parse({
    benchmarkId: result.id,
    requestedBasis: basis,
    requestedCurrency: currency,
    status:
      result.status !== "ready" ? "unavailable" : reasons.length ? "incompatible" : "compatible",
    reasons,
  });
}
export class BenchmarkService {
  constructor(
    private readonly store: SnapshotRepository,
    private readonly engine: BenchmarkEngine,
    private readonly adjustments: AdjustmentService,
    private readonly datasets: MarketDataService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
  ) {}
  definitions() {
    return this.store.all("benchmark-definition").map((v) => benchmarkDefinitionSchema.parse(v));
  }
  definition(id: string) {
    const value = this.store.get("benchmark-definition", id, 1);
    if (!value) throw new ApplicationError("NOT_FOUND", "Benchmark definition not found.");
    return benchmarkDefinitionSchema.parse(value);
  }
  list() {
    return this.store.all("benchmark").map((v) => benchmarkResultSchema.parse(v));
  }
  get(id: string) {
    const value = this.store.get("benchmark", id, 1);
    if (!value) throw new ApplicationError("NOT_FOUND", "Benchmark result not found.");
    return benchmarkResultSchema.parse(value);
  }
  define(value: BenchmarkDefinitionInput, context: CommandContext) {
    const input = benchmarkDefinitionInputSchema.parse(value);
    return this.commands.executeSync("benchmark.define", input, context, () => {
      for (const ref of input.adjustmentRuns) this.adjustments.get(ref.id, ref.revision);
      const definition = benchmarkDefinitionSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: this.clock.now(),
        input,
        weighting: "equal_weight_at_start",
        rebalance: "start_only_buy_and_hold",
        incomeConvention: input.returnBasis === "price" ? "excluded" : "gross_reinvested_no_tax",
        policyVersion: "chapter-6.v1",
      });
      this.store.append("benchmark-definition", definition.id, 1, definition);
      return definition;
    });
  }
  calculate(definitionId: string, context: CommandContext) {
    return this.commands.executeSync("benchmark.calculate", { definitionId }, context, () => {
      const definition = this.definition(definitionId);
      const sources = definition.input.adjustmentRuns.map((ref) => {
        const run = this.adjustments.get(ref.id, ref.revision);
        return { run, dataset: this.datasets.get(run.datasetId, run.datasetRevision) };
      });
      const result = benchmarkResultSchema.parse({
        id: this.ids.next(),
        createdAt: this.clock.now(),
        definition,
        ...this.engine.calculate(definition, sources),
      });
      this.store.append("benchmark", result.id, 1, result);
      return result;
    });
  }
}
