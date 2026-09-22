import type { PaperFill } from "@portfolio-atlas/contracts";
export interface PaperExecutionAnalytics {
  tick(price: string, tick: number): { valid: boolean; reason: string };
  residual(
    quantity: string,
    fills: PaperFill[],
  ): { filled: number; remaining: number; averagePrice: number | null };
}
