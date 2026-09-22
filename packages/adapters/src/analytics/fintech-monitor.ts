import { z } from "zod";
import { valueAtRiskIntuition } from "fintech-algorithms/foundations/financial-risk-and-performance-statistics/value-at-risk-intuition";
import { drawdownAndMaximumDrawdown } from "fintech-algorithms/foundations/financial-risk-and-performance-statistics/drawdown-and-maximum-drawdown";
import type { MonitorAnalytics } from "@portfolio-atlas/core";
export class FintechMonitorAnalytics implements MonitorAnalytics {
  calculate(returns: number[]) {
    if (returns.length < 2 || returns.some((r) => !Number.isFinite(r) || r < -1))
      throw new RangeError("Need two finite simple returns at least -1.");
    const input = { returns, benchmark: returns.map(() => 0), frequency: 1, confidence: 0.95 };
    const loss = z.object({ valueAtRisk: z.number().finite() }).parse(valueAtRiskIntuition(input)),
      drawdown = z
        .object({ maximumDrawdown: z.number().finite(), drawdowns: z.array(z.number().finite()) })
        .parse(drawdownAndMaximumDrawdown(input));
    return {
      valueAtRisk: loss.valueAtRisk,
      maximumDrawdown: Math.max(0, -drawdown.maximumDrawdown),
      drawdowns: drawdown.drawdowns.map((d) => Math.max(0, -d)),
    };
  }
}
