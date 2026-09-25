import type { LiveCadence, LiveInterval } from "@portfolio-atlas/contracts";

// Yahoo Finance serves intraday history for a limited lookback, and some intervals
// also limit the span of a single request. The limits are checked before any network
// call so an impossible request is refused with its reason, not sent and misread.
// Values follow the installed yahoo-finance2 4.0.2 chart documentation (intraday
// availability is limited; roughly 60 days) and the stricter observed 1m behavior
// (7 days per request within the last 30 days). A daily bar spans one session.
export const intervalLimits: Record<
  LiveInterval,
  {
    durationMs: number | null;
    maxLookbackDays: number | null;
    maxRequestDays: number | null;
    backfillDays: number;
  }
> = {
  "1m": { durationMs: 60_000, maxLookbackDays: 30, maxRequestDays: 7, backfillDays: 2 },
  "5m": { durationMs: 300_000, maxLookbackDays: 60, maxRequestDays: 60, backfillDays: 5 },
  "15m": { durationMs: 900_000, maxLookbackDays: 60, maxRequestDays: 60, backfillDays: 10 },
  "1h": { durationMs: 3_600_000, maxLookbackDays: 730, maxRequestDays: 730, backfillDays: 60 },
  "1d": { durationMs: null, maxLookbackDays: null, maxRequestDays: null, backfillDays: 400 },
};

// The bar interval that matches each refresh cadence. End of day keeps daily bars.
export function intervalForCadence(cadence: LiveCadence): LiveInterval {
  return cadence === "eod" ? "1d" : cadence;
}

export class IntervalLimitError extends Error {}

const day = 86_400_000;
export function checkIntervalWindow(interval: LiveInterval, from: string, to: string, now: string) {
  const limit = intervalLimits[interval];
  const start = Date.parse(from),
    end = Date.parse(to),
    at = Date.parse(now);
  if (!(end > start)) throw new IntervalLimitError("The window end must be after its start.");
  if (limit.maxLookbackDays !== null && at - start > limit.maxLookbackDays * day)
    throw new IntervalLimitError(
      interval +
        " bars are only available for the last " +
        limit.maxLookbackDays +
        " days; the window starts " +
        Math.floor((at - start) / day) +
        " days ago.",
    );
  if (limit.maxRequestDays !== null && end - start > limit.maxRequestDays * day)
    throw new IntervalLimitError(
      "A single " + interval + " request may span at most " + limit.maxRequestDays + " days.",
    );
}
