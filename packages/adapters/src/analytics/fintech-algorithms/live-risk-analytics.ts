import { calculate as ewma } from "fintech-algorithms/volatility-and-covariance/covariance-estimation/ewma-covariance";
import { betaAndMarketRelativeRisk } from "fintech-algorithms/foundations/financial-risk-and-performance-statistics/beta-and-market-relative-risk";
import { activeReturnAndTrackingError } from "fintech-algorithms/foundations/financial-risk-and-performance-statistics/active-return-and-tracking-error";
import { drawdownAndMaximumDrawdown } from "fintech-algorithms/foundations/financial-risk-and-performance-statistics/drawdown-and-maximum-drawdown";
import { z } from "zod";
import type { LiveRiskAnalytics } from "@portfolio-atlas/core";

const matrix = z.object({ matrix: z.array(z.array(z.number().finite())) });
// The D00 engine reads `confidence` for every topic even when unused; 0.95 is a
// placeholder that does not affect beta, tracking error or drawdown.
const d00 = { confidence: 0.95 };

// fintech-algorithms 0.13.2. All four topics are `verified`: shared-fixture parity
// with the catalog's Python implementation, not an independent third-party figure.
export class FintechLiveRiskAnalytics implements LiveRiskAnalytics {
  readonly tiers = {
    ewmaCovariance: "D10-F04-A02 verified",
    beta: "D00-F11-A07 verified",
    trackingError: "D00-F11-A09 verified",
    drawdown: "D00-F11 drawdown verified",
  };
  ewmaCovariance(returns: number[][], decay: number) {
    return matrix.parse(ewma({ returns, parameters: { decay } })).matrix;
  }
  beta(returns: number[], benchmark: number[]) {
    return z
      .object({ beta: z.number().finite() })
      .parse(betaAndMarketRelativeRisk({ returns, benchmark, frequency: 252, ...d00 })).beta;
  }
  trackingError(returns: number[], benchmark: number[], annualization: number) {
    return z
      .object({ trackingError: z.number().finite() })
      .parse(activeReturnAndTrackingError({ returns, benchmark, frequency: annualization, ...d00 }))
      .trackingError;
  }
  drawdown(returns: number[]) {
    const result = drawdownAndMaximumDrawdown({
      returns,
      benchmark: returns.map(() => 0),
      frequency: 1,
    });
    return { drawdowns: result.drawdowns, maximumDrawdown: result.maximumDrawdown };
  }
}
