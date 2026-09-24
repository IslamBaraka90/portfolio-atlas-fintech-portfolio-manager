import { classifyMarkets } from "fintech-algorithms/market-data-engineering/cleaning-and-validation/crossed-locked-market-detector";
import { detectStaleQuotes } from "fintech-algorithms/market-data-engineering/cleaning-and-validation/stale-quote-detector";
import { quotedSpread } from "fintech-algorithms/market-microstructure/liquidity-and-spreads/quoted-spread";
import type { QuoteAnalytics } from "@portfolio-atlas/core";

// fintech-algorithms 0.13.2. Tiers: stale-quote detector and crossed/locked detector
// are `contract` (shape checked, arithmetic not independently asserted); quoted spread
// is `verified` (shared-fixture parity with the catalog's Python implementation).
export const quoteAnalyticsTiers = {
  staleQuote: "D01-F02-A04 contract",
  crossedLocked: "D01-F02-A06 contract",
  quotedSpread: "D11-F02-A01 verified",
} as const;

export class FintechQuoteAnalytics implements QuoteAnalytics {
  // Each observation is its own single-event session: Yahoo supplies one timestamp
  // per poll, so source age and transport age are the same measurement here.
  stale(input: Parameters<QuoteAnalytics["stale"]>[0]) {
    const [verdict] = detectStaleQuotes(
      [
        {
          event_id: input.symbol,
          kind: "quote",
          source_event_ts: input.providerTime,
          observed_ts: input.observedAt,
          bid: input.bid,
          ask: input.ask,
          clock_sync_ok: true,
          session_id: input.symbol,
          session_state: input.active ? "ACTIVE" : "INACTIVE",
          activity_expected: input.active,
        },
      ],
      {
        max_source_event_age_ms: input.maxAgeMs,
        max_transport_age_ms: input.maxAgeMs,
        unchanged_threshold_ms: input.maxAgeMs,
        heartbeat_timeout_ms: input.maxAgeMs,
      },
    ) as { business_stale: boolean; reasons: string[] }[];
    return { stale: verdict!.business_stale, reasons: verdict!.reasons };
  }
  book(input: Parameters<QuoteAnalytics["book"]>[0]) {
    const [verdict] = classifyMarkets(
      [
        {
          instrument: input.symbol,
          market_scope: "PROVIDER_TOP_OF_BOOK",
          feed: "PROVIDER_POLL",
          event_time: input.providerTime,
          receive_time: input.observedAt,
          sequence: 1,
          bid_source: "PROVIDER",
          ask_source: "PROVIDER",
          bid: input.bid,
          ask: input.ask,
          tick_size: input.tickSize,
        },
      ],
      { tolerance_ticks: 0, relative_tolerance_ppm: 0 },
    ) as { state: string; reason: string | null }[];
    const state = verdict!.state;
    if (state === "NORMAL") return "normal" as const;
    if (state === "LOCKED") return "locked" as const;
    if (state === "CROSSED") return "crossed" as const;
    throw new Error("Unclassified book: " + (verdict!.reason ?? state));
  }
  spread(bid: number, ask: number) {
    const s = quotedSpread(bid, ask) as {
      quoted_spread: number;
      quoted_spread_bps: number;
      midpoint: number;
    };
    return { spread: s.quoted_spread, spreadBps: s.quoted_spread_bps, midpoint: s.midpoint };
  }
}
