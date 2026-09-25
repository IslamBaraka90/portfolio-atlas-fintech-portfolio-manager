import type { Instrument } from "@portfolio-atlas/contracts";
import {
  sessionState,
  type Clock,
  type ProviderReply,
  type QuoteBatch,
  type QuoteProvider,
  type RawQuote,
} from "@portfolio-atlas/core";
import { roundCents as round, syntheticBaseClose, syntheticPrice } from "./synthetic-market.js";

// Deterministic demo quotes for the synthetic teaching instruments. The price for a
// given symbol and minute is always the same (see synthetic-market.ts), so demo
// screenshots and tests replay and quotes agree with demo bars.
export class SyntheticQuoteProvider implements QuoteProvider {
  readonly mode = "synthetic" as const;
  readonly defaultSymbols: string[];
  private readonly bySymbol: Map<string, Instrument>;
  constructor(
    instruments: Instrument[],
    private readonly clock: Clock,
    private readonly baseClose = syntheticBaseClose,
  ) {
    this.bySymbol = new Map(instruments.map((i) => [i.returnedSymbol, i]));
    this.defaultSymbols = instruments.map((i) => i.returnedSymbol);
  }
  async quotes(symbols: string[]): Promise<ProviderReply<QuoteBatch>> {
    const now = this.clock.now();
    const minute = Math.floor(Date.parse(now) / 60_000);
    const rows: RawQuote[] = [];
    const missing: QuoteBatch["missing"] = [];
    for (const symbol of symbols) {
      const instrument = this.bySymbol.get(symbol);
      if (!instrument) {
        missing.push({ symbol, reason: "Not a synthetic teaching symbol." });
        continue;
      }
      const scale = instrument.quoteUnit.scaleToCurrency ?? 1;
      const unit = 1 / scale; // pence quotes are 100× the pound price
      const mid = syntheticPrice(symbol, minute) * unit;
      const open = sessionState(instrument.timezone ?? "America/New_York", now).state === "open";
      rows.push({
        symbol,
        providerTime: new Date(minute * 60_000).toISOString(),
        marketState: open ? "REGULAR" : "CLOSED",
        delaySeconds: 0,
        quoteUnit: instrument.quoteUnit,
        last: round(mid),
        bid: round(mid - 0.01 * unit),
        ask: round(mid + 0.01 * unit),
        bidSize: 300,
        askSize: 200,
        open: round(this.baseClose * unit),
        high: round(this.baseClose * 1.005 * unit),
        low: round(this.baseClose * 0.995 * unit),
        previousClose: round((this.baseClose - 1) * unit),
        volume: 150_000,
        priceHint: 2,
      });
    }
    return {
      status: "available",
      source: "synthetic",
      observedAt: now,
      cache: "fresh",
      data: { rows, missing, raw: { synthetic: true, minute, symbols } },
    };
  }
}
