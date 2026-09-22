import { scoreFixedSale } from "fintech-algorithms/portfolio-construction/practical-constraints/tax-aware-portfolio-optimization";
import { BookDecimal as D, type LotScoringEngine } from "@portfolio-atlas/core";
import type { TaxLot, LotScorePreview } from "@portfolio-atlas/contracts";
export class FintechLotScoringEngine implements LotScoringEngine {
  compare(
    instrumentId: string,
    price: string,
    quantity: string,
    bookLots: TaxLot[],
    at: string,
    coefficient: number,
  ): LotScorePreview {
    const base = {
      coefficient,
      packageVersion: "0.13.2" as const,
      tier: "contract" as const,
      affectsCash: false as const,
      changesBookLots: false as const,
    };
    try {
      const lots = bookLots
        .filter((l) => l.instrumentId === instrumentId && new D(l.quantityRemaining).gt(0))
        .map((l) => ({
          lotId: l.lotId,
          shares: Number(l.quantityRemaining),
          basisPerShare: new D(l.costRemaining).div(l.quantityRemaining).toNumber(),
          illustrativeRate: coefficient,
          acquiredOn: l.acquiredAt.slice(0, 10),
        }));
      if (lots.some((l) => l.shares > 1e9 || l.basisPerShare > 1e9) || Number(price) > 1e9)
        throw new Error("Lot scoring exceeds the numeric teaching bound.");
      const run = (fillOrder: "oldest-first" | "lowest-score") =>
        JSON.parse(
          JSON.stringify(
            scoreFixedSale(
              instrumentId,
              Number(price),
              lots,
              new D(quantity).mul(price).toNumber(),
              at.slice(0, 10),
              { fillOrder, policy: {} },
            ),
          ),
        ) as Record<string, unknown>;
      return {
        ...base,
        status: "available",
        reason:
          "Illustrative objective only. Missing jurisdiction/identification evidence is preserved. Package same-date tie order can differ from executable journal FIFO.",
        oldestFirst: run("oldest-first"),
        lowestScore: run("lowest-score"),
      };
    } catch (e) {
      return {
        ...base,
        status: "unavailable",
        reason: e instanceof Error ? e.message : String(e),
        oldestFirst: null,
        lowestScore: null,
      };
    }
  }
}
