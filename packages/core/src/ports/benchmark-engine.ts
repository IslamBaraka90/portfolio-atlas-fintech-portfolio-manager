import type {
  AdjustmentResult,
  BenchmarkDefinition,
  BenchmarkResult,
  MarketDataset,
} from "@portfolio-atlas/contracts";
export interface BenchmarkSource {
  run: AdjustmentResult;
  dataset: MarketDataset;
}
export type BenchmarkCalculation = Pick<
  BenchmarkResult,
  | "status"
  | "reasons"
  | "warnings"
  | "constituents"
  | "series"
  | "totalReturn"
  | "packageVersion"
  | "verification"
>;
export interface BenchmarkEngine {
  calculate(definition: BenchmarkDefinition, sources: BenchmarkSource[]): BenchmarkCalculation;
}
