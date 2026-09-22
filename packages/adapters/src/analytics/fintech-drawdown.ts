import { drawdownAndMaximumDrawdown } from "fintech-algorithms/foundations/financial-risk-and-performance-statistics/drawdown-and-maximum-drawdown";
import type { DrawdownEngine } from "@portfolio-atlas/core";
export class FintechDrawdownEngine implements DrawdownEngine {
  calculate(returns: number[]) {
    const result = drawdownAndMaximumDrawdown({
      returns,
      benchmark: returns.map(() => 0),
      frequency: 1,
    });
    return { drawdowns: result.drawdowns, maximumDrawdown: result.maximumDrawdown };
  }
}
