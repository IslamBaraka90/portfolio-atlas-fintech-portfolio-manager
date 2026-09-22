import { tickSizeValidation } from "fintech-algorithms/matching-engines-and-venue-logic/order-controls/tick-size-validation";
import { partialFillResidual } from "fintech-algorithms/matching-engines-and-venue-logic/order-lifecycle-and-queue-state/partial-fill-and-residual-quantity-processing";
import { BookDecimal as D, type PaperExecutionAnalytics } from "@portfolio-atlas/core";
import type { PaperFill } from "@portfolio-atlas/contracts";
export class FintechPaperExecutionAnalytics implements PaperExecutionAnalytics {
  tick(price: string, tick: number) {
    const atoms = new D(price).mul(100000000),
      tickAtoms = new D(tick).mul(100000000);
    if (
      !atoms.isInteger() ||
      !tickAtoms.isInteger() ||
      atoms.gt(Number.MAX_SAFE_INTEGER) ||
      tickAtoms.gt(Number.MAX_SAFE_INTEGER)
    )
      return { valid: false, reason: "Price/tick cannot be represented as safe integer atoms." };
    const result = tickSizeValidation(
      atoms.toNumber(),
      tickAtoms.toNumber(),
      100000000,
      "atlas-synthetic-tick-v1",
    );
    return { valid: result.valid === true, reason: String(result.reason) };
  }
  residual(quantity: string, fills: PaperFill[]) {
    const result = partialFillResidual(
      Number(quantity),
      fills.map((f) => ({
        execution_id: f.id,
        quantity: Number(f.quantity),
        price: Number(f.price),
      })),
    );
    const filled = Number(result.cumulative_quantity),
      remaining = Number(result.leaves_quantity),
      averagePrice = result.average_fill_price === null ? null : Number(result.average_fill_price);
    if (
      !Number.isSafeInteger(filled) ||
      !Number.isSafeInteger(remaining) ||
      remaining < 0 ||
      filled + remaining !== Number(quantity) ||
      (averagePrice !== null && !Number.isFinite(averagePrice))
    )
      throw new Error("Package residual accounting returned inconsistent values.");
    return { filled, remaining, averagePrice };
  }
}
