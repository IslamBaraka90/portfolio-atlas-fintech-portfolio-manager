import type {
  ActionReview,
  AdjustmentRequest,
  AdjustmentResult,
  CorporateAction,
  MarketDataset,
} from "@portfolio-atlas/contracts";
export interface ActionNormalizer {
  normalize(
    dataset: MarketDataset,
    raw: unknown,
  ): { actions: CorporateAction[]; warnings: string[] };
}
export interface ActionRepository {
  reviews(): ActionReview[];
  review(id: string): ActionReview | undefined;
  saveReview(review: ActionReview): void;
  runs(): AdjustmentResult[];
  run(id: string, revision?: number): AdjustmentResult | undefined;
  saveRun(run: AdjustmentResult): void;
}
export interface AdjustmentEngine {
  calculate(
    dataset: MarketDataset,
    review: ActionReview,
    input: AdjustmentRequest,
    createdAt: string,
  ): Pick<
    AdjustmentResult,
    "status" | "series" | "selectedActions" | "excludedActions" | "fx" | "reasons" | "warnings"
  >;
}
