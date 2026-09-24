import { z } from "zod";
import type { Clock, QuoteBatch, QuoteProvider, RawQuote } from "@portfolio-atlas/core";
import { ProviderCalls } from "../provider-calls.js";
import type { RequestBudget } from "../request-budget.js";
import { quoteUnit } from "./instrument-provider.js";

export interface YahooQuoteTransport {
  // One batched request. The transport disables library result validation so one
  // drifted symbol cannot discard the batch; this adapter validates each row itself.
  quotes(symbols: string[], signal: AbortSignal): Promise<unknown>;
}

const number = z.number().finite().optional().nullable();
// Yahoo's raw quote endpoint reports times as epoch seconds; the validated library
// path converts them to Date. Accept both and record ISO instants.
const time = z
  .union([z.date(), z.number().finite()])
  .optional()
  .nullable()
  .transform((v) =>
    v === undefined || v === null
      ? null
      : new Date(v instanceof Date ? v.getTime() : v * 1000).toISOString(),
  );
const rowSchema = z
  .object({
    symbol: z.string().min(1),
    currency: z.string().optional(),
    marketState: z.string().optional(),
    exchangeDataDelayedBy: z.number().int().nonnegative().optional(),
    regularMarketTime: time,
    regularMarketPrice: number,
    regularMarketOpen: number,
    regularMarketDayHigh: number,
    regularMarketDayLow: number,
    regularMarketPreviousClose: number,
    regularMarketVolume: number,
    bid: number,
    ask: number,
    bidSize: number,
    askSize: number,
    priceHint: number,
  })
  .passthrough();

const orNull = (v: number | null | undefined) => (v === undefined ? null : v);
// Yahoo sends 0 for an absent bid or ask outside regular hours; zero is not a price.
const positive = (v: number | null | undefined) => (v && v > 0 ? v : null);

export function mapYahooQuote(row: z.infer<typeof rowSchema>): RawQuote {
  return {
    symbol: row.symbol,
    providerTime: row.regularMarketTime,
    marketState: row.marketState ?? null,
    delaySeconds: row.exchangeDataDelayedBy === undefined ? null : row.exchangeDataDelayedBy * 60,
    quoteUnit: quoteUnit(row.currency),
    last: positive(row.regularMarketPrice),
    bid: positive(row.bid),
    ask: positive(row.ask),
    bidSize: orNull(row.bidSize),
    askSize: orNull(row.askSize),
    open: positive(row.regularMarketOpen),
    high: positive(row.regularMarketDayHigh),
    low: positive(row.regularMarketDayLow),
    previousClose: positive(row.regularMarketPreviousClose),
    volume: orNull(row.regularMarketVolume),
    priceHint: orNull(row.priceHint),
  };
}

export class YahooQuoteProvider extends ProviderCalls implements QuoteProvider {
  readonly mode = "yahoo" as const;
  constructor(
    private readonly transport: YahooQuoteTransport,
    clock: Clock,
    budget: RequestBudget,
    ttlMs: number,
  ) {
    super("yahoo", clock, budget, ttlMs);
  }
  quotes(symbols: string[]) {
    return this.call<QuoteBatch>(JSON.stringify(symbols), async (signal) => {
      const raw = await this.transport.quotes(symbols, signal);
      const list = z.array(z.unknown()).parse(raw);
      const rows: RawQuote[] = [];
      const seen = new Set<string>();
      const missing: QuoteBatch["missing"] = [];
      for (const item of list) {
        const parsed = rowSchema.safeParse(item);
        if (!parsed.success) {
          const symbol = z.object({ symbol: z.string() }).safeParse(item);
          if (symbol.success) {
            seen.add(symbol.data.symbol);
            missing.push({
              symbol: symbol.data.symbol,
              reason: "Quote shape did not match the verified contract.",
            });
          }
          continue;
        }
        seen.add(parsed.data.symbol);
        rows.push(mapYahooQuote(parsed.data));
      }
      for (const symbol of symbols)
        if (!seen.has(symbol))
          missing.push({ symbol, reason: "Yahoo returned no quote for this symbol." });
      return { rows, missing, raw };
    });
  }
}
