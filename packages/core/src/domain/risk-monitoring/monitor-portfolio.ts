import type {
  MonitorSnapshot,
  MonitorRequest,
  ValuationSnapshot,
  RiskModelSnapshot,
  TargetSnapshot,
  Mandate,
  Instrument,
} from "@portfolio-atlas/contracts";
import type { MonitorAnalytics } from "../../ports/monitor-analytics.js";
import { BookDecimal as D, signedMoney } from "../accounting/decimal.js";
export function monitorFreshness(v: ValuationSnapshot, checkpoint: number, now: string) {
  const reasons: string[] = [];
  if (v.status !== "complete" || v.totals.nav === null || new D(v.totals.nav).lte(0))
    reasons.push("Complete positive NAV is required.");
  if (v.book.checkpoint !== checkpoint) reasons.push("Book checkpoint changed.");
  const dates = [
    v.request.asOf,
    ...v.positions.filter((p) => new D(p.quantity).gt(0)).map((p) => p.mark.quotedAt),
    ...v.fxEvidence.map((f) => f.observedAt),
  ];
  if (
    dates.some(
      (d) => !d || Date.parse(now) - Date.parse(d) > 3600000 || Date.parse(d) > Date.parse(now),
    )
  )
    reasons.push("Valuation, mark or FX evidence is older than one hour or unavailable.");
  return reasons;
}
export function monitorPortfolio(
  request: MonitorRequest,
  valuation: ValuationSnapshot,
  mandate: Mandate,
  instruments: Instrument[],
  risk: RiskModelSnapshot | null,
  target: TargetSnapshot | null,
  checkpoint: number,
  now: string,
  analytics: MonitorAnalytics,
) {
  const freshnessReasons = monitorFreshness(valuation, checkpoint, now),
    fresh = freshnessReasons.length === 0;
  const nav = new D(valuation.totals.nav ?? 0);
  const numericSafe =
    nav.gt(0) &&
    nav.lte(1e9) &&
    valuation.positions.every(
      (p) => p.marketValueBase !== null && new D(p.marketValueBase).abs().lte(1e9),
    );
  if (!numericSafe)
    freshnessReasons.push("Exposure conversion needs complete values and NAV at most one billion.");
  const usable = fresh && numericSafe;
  const positions: MonitorSnapshot["positions"] = [],
    sectors: MonitorSnapshot["sectors"] = [],
    currencies: MonitorSnapshot["currencies"] = [],
    scenario: MonitorSnapshot["scenario"] = [];
  function aggregate(rows: MonitorSnapshot["sectors"], subject: string, value: string) {
    const row = rows.find((r) => r.subject === subject);
    if (row) {
      row.value = signedMoney(new D(row.value).plus(value));
      row.weight = new D(row.value).div(nav).toNumber();
    } else rows.push({ subject, value, weight: new D(value).div(nav).toNumber() });
  }
  if (numericSafe) {
    for (const p of valuation.positions) {
      if (new D(p.quantity).isZero()) continue;
      positions.push({
        subject: p.instrumentId,
        value: p.marketValueBase!,
        weight: new D(p.marketValueBase!).div(nav).toNumber(),
      });
      aggregate(
        sectors,
        instruments.find((i) => i.instrumentId === p.instrumentId)?.sector ?? "UNKNOWN",
        p.marketValueBase!,
      );
      aggregate(currencies, p.currency, p.marketValueBase!);
      scenario.push({
        subject: p.instrumentId,
        baseValue: p.marketValueBase!,
        change: signedMoney(new D(p.marketValueBase!).times(request.shock)),
      });
    }
    for (const c of valuation.cash)
      if (c.baseAmount !== null) aggregate(currencies, c.currency, c.baseAmount);
  }
  function history(weights: { subject: string; weight: number }[]): MonitorSnapshot["history"] {
    const unavailable: MonitorSnapshot["history"] = {
      status: "unavailable",
      reason: "Need fresh valuation and complete aligned base-currency simple-return history.",
      returns: [],
      losses: [],
      drawdowns: [],
      maximumDrawdown: null,
      valueAtRisk: null,
      confidence: 0.95,
      horizon: "one_supplied_daily_interval",
      quantile: "linear_index_(n-1)*p",
      basis: "hypothetical_current_weights_daily_reset",
    };
    if (
      !usable ||
      !risk ||
      risk.status !== "ready" ||
      risk.request.returnType !== "simple" ||
      risk.currency !== valuation.baseCurrency ||
      risk.returns.length < 2 ||
      weights.some((p) => !risk.assets.some((a) => a.instrumentId === p.subject))
    )
      return unavailable;
    const returns = risk.returns.map((row) =>
      weights.reduce(
        (sum, p) =>
          sum + p.weight * row[risk.assets.findIndex((a) => a.instrumentId === p.subject)]!,
        0,
      ),
    );
    if (returns.some((r) => !Number.isFinite(r) || r < -1)) return unavailable;
    return {
      ...unavailable,
      status: "available",
      reason: "Historical illustration with today's weights reset each interval; cash earns zero.",
      returns,
      losses: returns.map((r) => -r).sort((a, b) => a - b),
      ...analytics.calculate(returns),
    };
  }
  const h = history(positions),
    proposed =
      target?.weights && target.status === "proposal"
        ? target.assetIds.map((id, j) => ({ subject: id, weight: target.weights![j]! }))
        : null;
  const observations: MonitorSnapshot["observations"] = [];
  function observe(
    rule: string,
    subject: string,
    observed: number | null,
    limit: number | null,
    reason: string,
    lower = false,
  ) {
    const status =
      !usable || observed === null || limit === null
        ? "unavailable"
        : (lower ? observed < limit - 1e-10 : observed > limit + 1e-10)
          ? "breach"
          : "pass";
    observations.push({
      key: [valuation.request.portfolioId, "chapter-14.v1", mandate.revision, rule, subject].join(
        "|",
      ),
      rule,
      subject,
      status,
      observed: usable ? observed : null,
      limit,
      reason,
      severity: rule === "data_freshness" || rule === "drawdown" ? "high" : "review",
    });
  }
  observe(
    "data_freshness",
    "valuation",
    usable ? 0 : null,
    0,
    freshnessReasons.join(" ") || "Current book and evidence.",
  );
  for (const p of positions)
    observe(
      "position",
      p.subject,
      p.weight,
      mandate.maxPositionWeight,
      "Base market value / economic NAV.",
    );
  for (const s of sectors)
    observe(
      "sector",
      s.subject,
      s.subject === "UNKNOWN" ? null : s.weight,
      mandate.maxSectorWeight,
      "Unknown sectors cannot pass.",
    );
  // Keep previously held instruments' zero exposure observable, so findings can be explicitly resolved.
  for (const i of instruments)
    if (!positions.some((p) => p.subject === i.instrumentId))
      observe(
        "position",
        i.instrumentId,
        0,
        mandate.maxPositionWeight,
        "No current economic position.",
      );
  for (const sector of new Set(
    instruments.map((i) => i.sector).filter((s): s is string => s !== null),
  ))
    if (!sectors.some((s) => s.subject === sector))
      observe("sector", sector, 0, mandate.maxSectorWeight, "No current economic sector exposure.");
  const cash = usable ? new D(valuation.totals.cashBase!).div(nav).toNumber() : null;
  observe(
    "cash_floor",
    "cash",
    cash,
    mandate.minCashWeight,
    "Economic cash / NAV; available cash is separately reserved.",
    true,
  );
  observe("cash_ceiling", "cash", cash, mandate.maxCashWeight, "Economic cash / NAV.");
  const ids = new Set([
    ...positions.map((p) => p.subject),
    ...(proposed ?? []).map((p) => p.subject),
  ]);
  const maxDrift = proposed
    ? Math.max(
        Math.abs((cash ?? 0) - (target!.cashWeight ?? 0)),
        ...Array.from(ids, (id) =>
          Math.abs(
            (positions.find((p) => p.subject === id)?.weight ?? 0) -
              (proposed.find((p) => p.subject === id)?.weight ?? 0),
          ),
        ),
      )
    : null;
  observe(
    "drift",
    "portfolio",
    maxDrift,
    0.05,
    "Maximum absolute asset/cash weight difference from selected target.",
  );
  observe("drawdown", "historical illustration", h.maximumDrawdown, 0.2, h.reason);
  observe(
    "var",
    "historical illustration",
    h.valueAtRisk,
    0.05,
    "95% one-interval interpolated loss quantile, not maximum possible loss.",
  );
  observe(
    "liquidity",
    "portfolio",
    null,
    null,
    "Unavailable: no participation policy and sufficient validated volume history.",
  );
  return {
    fresh: usable,
    freshnessReasons,
    positions,
    sectors,
    currencies,
    scenario,
    scenarioTotal: usable
      ? signedMoney(scenario.reduce((s, p) => s.plus(p.change), new D(0)))
      : null,
    proposedScenarioTotal:
      usable && proposed
        ? signedMoney(nav.times(proposed.reduce((s, p) => s + p.weight, 0)).times(request.shock))
        : null,
    history: h,
    proposedHistory: proposed ? history(proposed) : null,
    observations,
    warnings: [
      "Exposure uses trade-date economic holdings, not custody delivery.",
      "Historical returns are a hypothetical current-weight replay; they are not realized portfolio performance.",
      "Price shock holds FX fixed and cash unchanged; derivatives, liquidity and execution costs are not modeled.",
      "VaR is a sample quantile, not a maximum loss or forecast guarantee; small synthetic samples are educational.",
      "Package 0.13.2 D00 methods: verified shared-fixture parity, not independent market validation.",
    ],
  };
}
