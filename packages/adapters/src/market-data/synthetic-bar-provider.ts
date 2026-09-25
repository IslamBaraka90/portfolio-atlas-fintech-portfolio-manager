import type { Instrument, LiveInterval } from "@portfolio-atlas/contracts";
import {
  intervalLimits,
  sessionBounds,
  type BarBatch,
  type BarProvider,
  type Clock,
  type ProviderReply,
  type RawBar,
} from "@portfolio-atlas/core";
import { roundCents, syntheticBaseClose, syntheticPrice } from "./synthetic-market.js";

const day = 86_400_000;

// Deterministic demo bars for the synthetic teaching instruments, built from the
// shared demo price path during regular New York or London hours. The provider walks
// one session at a time (open and close resolved once per date), buckets minutes
// from the session open like Yahoo does (hourly bars start at :30 in New York), and
// never builds past the clock, so the latest bar can be genuinely forming.
export class SyntheticBarProvider implements BarProvider {
  readonly mode = "synthetic" as const;
  private readonly bySymbol: Map<string, Instrument>;
  constructor(
    instruments: Instrument[],
    private readonly clock: Clock,
  ) {
    this.bySymbol = new Map(instruments.map((i) => [i.returnedSymbol, i]));
  }
  async bars(
    symbol: string,
    interval: LiveInterval,
    window: { from: string; to: string },
  ): Promise<ProviderReply<BarBatch>> {
    const now = this.clock.now();
    const instrument = this.bySymbol.get(symbol);
    if (!instrument)
      return {
        status: "unavailable",
        source: "synthetic",
        observedAt: now,
        cache: "none",
        failure: {
          code: "NOT_FOUND",
          message: "Not a synthetic teaching symbol.",
          retryable: false,
        },
      };
    const timezone = instrument.timezone ?? "America/New_York";
    const unit = 1 / (instrument.quoteUnit.scaleToCurrency ?? 1);
    const start = Math.ceil(Date.parse(window.from) / 60_000) * 60_000;
    const end = Math.min(Date.parse(window.to), Date.parse(now));
    const duration = intervalLimits[interval].durationMs;
    const rows: RawBar[] = [];
    // Local dates overlap UTC dates by at most one day either side.
    for (let d = start - day; d <= end + day; d += day) {
      const date = new Date(d).toISOString().slice(0, 10);
      const bounds = sessionBounds(timezone, date);
      if (!bounds) continue;
      const open = Date.parse(bounds.open),
        close = Date.parse(bounds.close);
      const from = Math.max(open, start),
        to = Math.min(close, end);
      if (from >= to) continue;
      const bucket = duration ?? close - open;
      for (let b = open + Math.floor((from - open) / bucket) * bucket; b < to; b += bucket) {
        // A bar is always built from its own start, even when the window begins
        // inside it, so overlapping refreshes see identical values for a final bar.
        const first = b,
          last = Math.min(b + bucket, to);
        if (first >= last) continue;
        const prices: number[] = [];
        for (let t = first; t < last; t += 60_000)
          prices.push(syntheticPrice(symbol, t / 60_000) * unit);
        rows.push({
          timestamp: new Date(duration === null ? open : b).toISOString(),
          open: roundCents(prices[0]!),
          high: roundCents(Math.max(...prices)),
          low: roundCents(Math.min(...prices)),
          close: roundCents(prices.at(-1)!),
          volume: prices.length * 1_000,
        });
      }
    }
    return {
      status: "available",
      source: "synthetic",
      observedAt: now,
      cache: "fresh",
      data: {
        symbol,
        timezone,
        quoteUnit: instrument.quoteUnit,
        priceHint: 2,
        rows,
        raw: { synthetic: true, symbol, interval, window, base: syntheticBaseClose },
      },
    };
  }
}
