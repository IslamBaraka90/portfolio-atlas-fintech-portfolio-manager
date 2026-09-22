import type {
  AdjustmentResult,
  CompanyObservation,
  MarketDataset,
  ResearchRequest,
  ResearchResult,
} from "@portfolio-atlas/contracts";
export interface ResearchSource {
  dataset: MarketDataset;
  run: AdjustmentResult | null;
}
export type ResearchCalculation = Pick<
  ResearchResult,
  | "trends"
  | "fundamentals"
  | "breadth"
  | "warnings"
  | "packageVersion"
  | "verification"
  | "createsOrders"
  | "policyVersion"
>;
export interface ResearchEngine {
  calculate(
    request: ResearchRequest,
    sources: ResearchSource[],
    companies: CompanyObservation[],
  ): ResearchCalculation;
}
