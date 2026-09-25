import type { LiveBar, LiveRisk } from "@portfolio-atlas/contracts";

// Port for the fintech-algorithms calculations used on live history.
export interface LiveRiskAnalytics {
  // Daily covariance of aligned simple returns (rows: sessions, columns: assets).
  ewmaCovariance(returns: number[][], decay: number): number[][];
  beta(returns: number[], benchmark: number[]): number;
  trackingError(returns: number[], benchmark: number[], annualization: number): number;
  drawdown(returns: number[]): { drawdowns: number[]; maximumDrawdown: number };
  readonly tiers: Record<string, string>;
}

export const liveRiskPolicy = "chapter-23.live-risk.v1";
export const liveRiskWindow = { maxReturns: 60, minReturns: 3, decay: 0.94, annualization: 252 };

// Only final, accepted daily closes enter risk: a forming bar would change the
// numbers every tick. Sessions are aligned on dates present for every series; the
// count of dates dropped by alignment is reported, because a missing date for one
// asset turns its neighbouring return into a two-session return.
export function alignDailyCloses(series: LiveBar[][]) {
  const usable = series.map(
    (bars) =>
      new Map(
        bars
          .filter((b) => b.finality === "final" && b.accepted && b.close !== null && b.sessionDate)
          .map((b) => [b.sessionDate!, b.close!]),
      ),
  );
  const all = new Set(usable.flatMap((m) => [...m.keys()]));
  const dates = [...all].filter((d) => usable.every((m) => m.has(d))).sort();
  const kept = dates.slice(-(liveRiskWindow.maxReturns + 1));
  const returns = kept
    .slice(1)
    .map((date, i) => usable.map((m) => m.get(date)! / m.get(kept[i]!)! - 1));
  return {
    dates: kept,
    returns,
    droppedSessions: all.size - dates.length,
  };
}

// Current-weight replay: today's weights applied to each historical session. This is
// a hypothetical risk estimate, not the portfolio's realized performance.
export function liveRisk(input: {
  portfolioId: string;
  valuationId: string;
  asOf: string;
  benchmark: string;
  holdings: { instrumentId: string; symbol: string | null; weight: number; bars: LiveBar[] }[];
  benchmarkBars: LiveBar[];
  navs: number[];
  analytics: LiveRiskAnalytics;
}): Omit<LiveRisk, "monitor"> {
  const { analytics } = input;
  const reasons: string[] = [];
  const priced = input.holdings.filter((h) => h.bars.length > 0);
  const aligned = alignDailyCloses([...priced.map((h) => h.bars), input.benchmarkBars]);
  const enough = aligned.returns.length >= liveRiskWindow.minReturns;
  if (!input.benchmarkBars.length)
    reasons.push("No daily history for benchmark " + input.benchmark + ".");
  if (priced.length < input.holdings.length)
    reasons.push("Some holdings have no daily history; they are excluded from risk.");
  if (!enough)
    reasons.push(
      "At least " +
        liveRiskWindow.minReturns +
        " aligned final daily returns are required; " +
        aligned.returns.length +
        " available.",
    );
  if (aligned.droppedSessions)
    reasons.push(
      aligned.droppedSessions + " session date(s) dropped because a series lacked them.",
    );
  const bench = aligned.returns.map((r) => r.at(-1)!);
  let covariance: number[][] | null = null;
  if (enough && priced.length)
    // Estimated over holdings and the benchmark together: the EWMA topic needs at
    // least two columns, and the holdings block is all portfolio variance uses.
    covariance = analytics.ewmaCovariance(aligned.returns, liveRiskWindow.decay);
  const annual = (v: number) => Math.sqrt(Math.max(0, v) * liveRiskWindow.annualization);
  const safe = <T>(f: () => T): T | null => {
    try {
      return f();
    } catch {
      return null;
    }
  };
  const holdings = input.holdings.map((h) => {
    const j = priced.indexOf(h);
    const own = j < 0 ? [] : aligned.returns.map((r) => r[j]!);
    return {
      instrumentId: h.instrumentId,
      symbol: h.symbol,
      weight: h.weight,
      ewmaVolatility: covariance && j >= 0 ? annual(covariance[j]![j]!) : null,
      beta: enough && j >= 0 ? safe(() => analytics.beta(own, bench)) : null,
    };
  });
  const weights = priced.map((h) => h.weight);
  const portfolioReturns = aligned.returns.map((r) =>
    weights.reduce((sum, w, j) => sum + w * r[j]!, 0),
  );
  const variance = covariance
    ? weights.reduce(
        (sum, wi, i) =>
          sum + weights.reduce((inner, wj, j) => inner + wi * wj * covariance![i]![j]!, 0),
        0,
      )
    : null;
  const navReturns = input.navs.slice(1).map((v, i) => v / input.navs[i]! - 1);
  // Drawdowns are negative fractions from the running peak (0 at a new high).
  const drawdown = navReturns.length >= 2 ? safe(() => analytics.drawdown(navReturns)) : null;
  if (navReturns.length < 2) reasons.push("Drawdown needs at least three valued NAV points.");
  const complete = enough && priced.length > 0 && input.benchmarkBars.length > 0;
  return {
    id: input.portfolioId + "|" + input.valuationId,
    portfolioId: input.portfolioId,
    valuationId: input.valuationId,
    asOf: input.asOf,
    policy: liveRiskPolicy,
    status: complete ? "complete" : "unavailable",
    benchmark: input.benchmark,
    window: {
      returns: aligned.returns.length,
      from: aligned.dates[0] ?? null,
      to: aligned.dates.at(-1) ?? null,
      droppedSessions: aligned.droppedSessions,
      decay: liveRiskWindow.decay,
      annualization: liveRiskWindow.annualization,
    },
    holdings,
    portfolio: {
      volatility: variance === null ? null : annual(variance),
      beta: complete ? safe(() => analytics.beta(portfolioReturns, bench)) : null,
      trackingError: complete
        ? safe(() => analytics.trackingError(portfolioReturns, bench, liveRiskWindow.annualization))
        : null,
      currentDrawdown: drawdown ? drawdown.drawdowns.at(-1)! : null,
      maxDrawdown: drawdown ? drawdown.maximumDrawdown : null,
      navPoints: input.navs.length,
    },
    reasons: [
      "Current weights replayed over past sessions; a hypothetical estimate, not realized performance.",
      ...reasons,
    ],
    tiers: analytics.tiers,
  };
}
