import { validateBars } from "fintech-algorithms/market-data-engineering/cleaning-and-validation/ohlc-consistency-validator";
import { hampelFilter } from "fintech-algorithms/market-data-engineering/cleaning-and-validation/hampel-bad-tick-filter";
import type { BarFinding, LiveBarQuality, RawBar } from "@portfolio-atlas/core";

// Live provider policy chapter-20.live-bars.v1. It replaces three synthetic-only
// guarantees with observed checks, and says so on every row:
// - tick size is inferred from the provider's priceHint (warning INFERRED_TICK);
// - identity is the Chapter 2 instrument when saved, else the watchlist symbol;
// - finality comes from the session calendar in the service, not the vendor.
// OHLC consistency (D01, verified tier) and causal Hampel screening (D01-F02-A02,
// contract tier) run on reported prices. Hampel outliers are warnings: the bar stays.
export class FintechLiveBarQuality implements LiveBarQuality {
  readonly policy = "chapter-20.live-bars.v1";
  validate(input: {
    symbol: string;
    instrumentId: string | null;
    rows: RawBar[];
    priceHint: number | null;
    scale: number | null;
    observedAt: string;
  }) {
    const tick = 10 ** -(input.priceHint ?? 2);
    const ohlc = validateBars(
      input.rows.map((row, i) => ({
        bar_id: input.symbol + ":" + i,
        source: "live",
        symbol: input.symbol,
        timestamp: row.timestamp,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      })),
      { tickSize: tick, toleranceTicks: 1, priceScale: 1 },
    ) as { issues: string[] }[];
    const seen = new Set<string>();
    let previous = -Infinity;
    const results = input.rows.map((row, index) => {
      const findings: BarFinding[] = [];
      const add = (code: string, reason: string, severity: BarFinding["severity"] = "error") =>
        findings.push({ code, reason, severity });
      for (const issue of ohlc[index]?.issues ?? [])
        add(issue, "OHLC validator: " + issue.toLowerCase().replaceAll("_", " ") + ".");
      const time = Date.parse(row.timestamp);
      if (!Number.isFinite(time)) add("INVALID_EVENT_TIME", "A valid bar start time is required.");
      else {
        if (time > Date.parse(input.observedAt))
          add("FUTURE_EVENT", "Bar starts after this source observation.");
        if (time < previous)
          add("OUT_OF_ORDER", "Provider order moved backwards; rows were not silently sorted.");
        previous = Math.max(previous, time);
        if (seen.has(row.timestamp))
          add("DUPLICATE_TIMESTAMP", "Every copy of a repeated bar start is quarantined.");
        seen.add(row.timestamp);
      }
      for (const field of ["open", "high", "low", "close"] as const) {
        const value = row[field];
        if (value === null || !Number.isFinite(value) || value <= 0)
          add(
            "INVALID_PRICE_" + field.toUpperCase(),
            "Prices must be finite and positive; a missing price is never filled.",
          );
      }
      if (input.scale === null)
        add("UNKNOWN_UNITS", "The provider unit is not established; prices cannot be scaled.");
      add(
        "INFERRED_TICK",
        "Tick " + tick + " inferred from the provider price hint, not exchange evidence.",
        "warning",
      );
      if (input.instrumentId === null)
        add(
          "WATCHLIST_ONLY_IDENTITY",
          "Symbol is watched but not saved through Instrument discovery.",
          "warning",
        );
      if (row.volume === null)
        add("MISSING_VOLUME", "Volume analytics are not authorized.", "warning");
      else if (row.volume === 0)
        add("ZERO_VOLUME", "Observed zero volume is preserved as reported.", "warning");
      return { accepted: !findings.some((f) => f.severity === "error"), findings };
    });
    // Causal screening on the accepted closes only; indices map back to the rows.
    const usable = results
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => r.accepted && input.rows[i]!.close !== null);
    if (usable.length) {
      const verdicts = hampelFilter(
        usable.map(({ i }) => input.rows[i]!.close!),
        { windowRadius: 10, threshold: 5, scale: 1.4826, minHistory: 10, mode: "causal" },
      ) as { flagged: boolean; median: number; score: number | null }[];
      verdicts.forEach((v, k) => {
        if (v.flagged)
          usable[k]!.r.findings.push({
            code: "HAMPEL_OUTLIER",
            reason:
              "Close is " +
              (v.score?.toFixed(1) ?? "many") +
              " robust deviations from the trailing median " +
              v.median +
              "; kept for review.",
            severity: "warning",
          });
      });
    }
    return results;
  }
}
