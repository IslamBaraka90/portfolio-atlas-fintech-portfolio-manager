import type { TaxLot, LotScorePreview } from "@portfolio-atlas/contracts";
export interface LotScoringEngine {
  compare(
    instrumentId: string,
    price: string,
    quantity: string,
    lots: TaxLot[],
    at: string,
    coefficient: number,
  ): LotScorePreview;
}
