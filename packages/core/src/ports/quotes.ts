import type { DataMode, QuoteUnit } from "@portfolio-atlas/contracts";
import type { ProviderReply } from "./instrument-provider.js";

// A provider-neutral quote row. Adapters map vendor fields here; nothing downstream
// sees a Yahoo field name. Prices are in the provider's reported unit.
export interface RawQuote {
  symbol: string;
  providerTime: string | null;
  marketState: string | null;
  delaySeconds: number | null;
  quoteUnit: QuoteUnit;
  last: number | null;
  bid: number | null;
  ask: number | null;
  bidSize: number | null;
  askSize: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  volume: number | null;
  priceHint: number | null;
}

export interface QuoteBatch {
  rows: RawQuote[];
  // Requested symbols the provider did not return, or returned in an unusable shape.
  missing: { symbol: string; reason: string }[];
  raw: unknown;
}

export interface QuoteProvider {
  readonly mode: DataMode;
  // Symbols this provider serves by default when a watchlist starts empty.
  readonly defaultSymbols?: string[];
  quotes(symbols: string[]): Promise<ProviderReply<QuoteBatch>>;
}

// Boundary validation implemented with fintech-algorithms in adapters.
export interface QuoteAnalytics {
  stale(input: {
    symbol: string;
    providerTime: string;
    observedAt: string;
    active: boolean;
    maxAgeMs: number;
    bid: number | null;
    ask: number | null;
  }): { stale: boolean; reasons: string[] };
  book(input: {
    symbol: string;
    providerTime: string;
    observedAt: string;
    bid: number;
    ask: number;
    tickSize: number;
  }): "normal" | "locked" | "crossed";
  spread(bid: number, ask: number): { spread: number; spreadBps: number; midpoint: number };
}
