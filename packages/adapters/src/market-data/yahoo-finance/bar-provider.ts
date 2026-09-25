import { z } from "zod";
import type { LiveInterval } from "@portfolio-atlas/contracts";
import type { BarBatch, BarProvider, Clock } from "@portfolio-atlas/core";
import { ProviderCalls } from "../provider-calls.js";
import type { RequestBudget } from "../request-budget.js";
import { quoteUnit } from "./instrument-provider.js";

export interface YahooBarTransport {
  bars(
    symbol: string,
    request: { from: string; to: string; interval: LiveInterval },
    signal: AbortSignal,
  ): Promise<unknown>;
}

const value = z.number().finite().nullable().optional();
const chartSchema = z
  .object({
    meta: z
      .object({
        symbol: z.string(),
        currency: z.string().optional(),
        exchangeTimezoneName: z.string().optional(),
        priceHint: z.number().optional(),
      })
      .passthrough(),
    quotes: z.array(
      z
        .object({
          date: z.date(),
          open: value,
          high: value,
          low: value,
          close: value,
          volume: value,
        })
        .passthrough(),
    ),
  })
  .passthrough();

// Live intraday and daily bars. Only regular-session bars are requested; the core
// decides finality from the exchange calendar because Yahoo does not label it.
export class YahooBarProvider extends ProviderCalls implements BarProvider {
  readonly mode = "yahoo" as const;
  constructor(
    private readonly transport: YahooBarTransport,
    clock: Clock,
    budget: RequestBudget,
    ttlMs: number,
  ) {
    super("yahoo", clock, budget, ttlMs);
  }
  bars(symbol: string, interval: LiveInterval, window: { from: string; to: string }) {
    return this.call<BarBatch>(
      JSON.stringify(["bars", symbol, interval, window.from, window.to]),
      async (signal) => {
        const raw = chartSchema.parse(
          await this.transport.bars(symbol, { ...window, interval }, signal),
        );
        return {
          symbol: raw.meta.symbol,
          timezone: raw.meta.exchangeTimezoneName ?? null,
          quoteUnit: quoteUnit(raw.meta.currency),
          priceHint: raw.meta.priceHint ?? null,
          rows: raw.quotes.map((q) => ({
            timestamp: q.date.toISOString(),
            open: q.open ?? null,
            high: q.high ?? null,
            low: q.low ?? null,
            close: q.close ?? null,
            volume: q.volume ?? null,
          })),
          raw,
        };
      },
    );
  }
}
