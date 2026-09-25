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

export interface BarFinding {
  code: string;
  reason: string;
  severity: "error" | "warning";
}
// Live bar validation policy implemented with fintech-algorithms in adapters.
export interface LiveBarQuality {
  readonly policy: string;
  validate(input: {
    symbol: string;
    instrumentId: string | null;
    rows: RawBar[];
    priceHint: number | null;
    scale: number | null;
    observedAt: string;
  }): { accepted: boolean; findings: BarFinding[] }[];
}
