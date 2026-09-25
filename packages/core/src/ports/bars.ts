import type { DataMode, LiveInterval, QuoteUnit } from "@portfolio-atlas/contracts";
import type { ProviderReply } from "./instrument-provider.js";

// Provider-neutral bars in the provider's reported unit. `timestamp` is the bar's
// start instant; finality is decided by the core session calendar, not the vendor.
export interface RawBar {
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}
export interface BarBatch {
  symbol: string;
  timezone: string | null;
  quoteUnit: QuoteUnit;
  priceHint: number | null;
  rows: RawBar[];
  raw: unknown;
}
export interface BarProvider {
  readonly mode: DataMode;
  bars(
    symbol: string,
    interval: LiveInterval,
    window: { from: string; to: string },
  ): Promise<ProviderReply<BarBatch>>;
}
