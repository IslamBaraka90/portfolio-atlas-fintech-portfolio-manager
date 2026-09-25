import type { Instrument, LiveInterval } from "@portfolio-atlas/contracts";
import {
  intervalLimits,
  sessionState,
  type BarBatch,
  type BarProvider,
  type Clock,
  type ProviderReply,
  type RawBar,
} from "@portfolio-atlas/core";
import { roundCents, syntheticBaseClose, syntheticPrice } from "./synthetic-market.js";

// Deterministic demo bars for the synthetic teaching instruments, built minute by
// minute from the shared demo price path during regular New York or London hours.
// Bars never extend past the clock, so the latest bar can be genuinely forming.
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
    const end = Math.min(Date.parse(window.to), Date.parse(now));
    const start = Math.ceil(Date.parse(window.from) / 60_000) * 60_000;
    // Group open-market minutes into bars: fixed-duration buckets intraday, one bar
    // per local session date for daily bars (timestamped at the first open minute).
    const buckets = new Map<string, number[]>();
    for (let t = start; t < end; t += 60_000) {
      const session = sessionState(timezone, new Date(t).toISOString());
      if (session.state !== "open") continue;
      const duration = intervalLimits[interval].durationMs;
      const key =
        duration === null
          ? session.localDate!
          : new Date(Math.floor(t / duration) * duration).toISOString();
      const minutes = buckets.get(key) ?? [];
      minutes.push(t);
      buckets.set(key, minutes);
    }
    const rows: RawBar[] = [...buckets.entries()].map(([key, minutes]) => {
      const prices = minutes.map((t) => syntheticPrice(symbol, t / 60_000) * unit);
      return {
        timestamp:
          intervalLimits[interval].durationMs === null ? new Date(minutes[0]!).toISOString() : key,
        open: roundCents(prices[0]!),
        high: roundCents(Math.max(...prices)),
        low: roundCents(Math.min(...prices)),
        close: roundCents(prices.at(-1)!),
        volume: minutes.length * 1_000,
      };
    });
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
