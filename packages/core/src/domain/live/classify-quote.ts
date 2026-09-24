import type {
  DataMode,
  LiveRuntimePolicy,
  QuoteFreshness,
  QuoteObservation,
} from "@portfolio-atlas/contracts";
import type { QuoteAnalytics, RawQuote } from "../../ports/quotes.js";

export const quotePolicyVersion = "chapter-19.quote-freshness.v1";
// Provider clocks ahead of ours by more than this are treated as a timestamp error.
const maxClockSkewMs = 60_000;

const scaled = (value: number | null, scale: number | null) =>
  value === null || scale === null ? null : Number((value * scale).toFixed(10));

// Freshness policy chapter-19.quote-freshness.v1, in order:
// 1. no provider time or no price → unavailable;
// 2. provider time more than 60 s after our observation → unavailable (clock error);
// 3. market state other than REGULAR → closed_market (the last price is the close);
// 4. age beyond freshness + the exchange's declared delay → stale;
// 5. a declared exchange delay → delayed; otherwise live.
// The exchange delay is expected, so it extends the age budget instead of making
// every delayed feed stale.
export function classifyQuote(
  raw: RawQuote,
  context: {
    id: string;
    cycleId: string | null;
    instrumentId: string | null;
    source: DataMode;
    observedAt: string;
    sourceHash: string | null;
    policy: Pick<LiveRuntimePolicy, "freshnessSeconds">;
  },
  analytics: QuoteAnalytics,
): QuoteObservation {
  const reasons: string[] = [];
  const scale = raw.quoteUnit.scaleToCurrency;
  if (scale === null) reasons.push("Quote unit is not established; currency prices are withheld.");
  const price = (v: number | null) => scaled(v, scale);
  const last = price(raw.last);
  const previousClose = price(raw.previousClose);

  // Book state from the reported (unscaled) prices, so the tick grid matches.
  let book: QuoteObservation["book"] = {
    state: "absent",
    spread: null,
    spreadBps: null,
    midpoint: null,
  };
  if (raw.bid !== null && raw.ask !== null && raw.providerTime) {
    const tickSize = raw.priceHint !== null ? 10 ** -raw.priceHint : 0.01;
    try {
      const state = analytics.book({
        symbol: raw.symbol,
        providerTime: raw.providerTime,
        observedAt: context.observedAt,
        bid: raw.bid,
        ask: raw.ask,
        tickSize,
      });
      if (state === "crossed") {
        book = { state, spread: null, spreadBps: null, midpoint: null };
        reasons.push("Crossed book: bid above ask; spread and midpoint are withheld.");
      } else {
        const s = analytics.spread(raw.bid, raw.ask);
        book = {
          state,
          spread: price(s.spread),
          spreadBps: Number(s.spreadBps.toFixed(4)),
          midpoint: price(s.midpoint),
        };
        if (state === "locked") reasons.push("Locked book: bid equals ask.");
      }
    } catch (error) {
      reasons.push("Book check failed: " + (error instanceof Error ? error.message : "unknown"));
    }
  } else if (raw.bid !== null || raw.ask !== null) {
    book = { state: "one_sided", spread: null, spreadBps: null, midpoint: null };
    reasons.push("One-sided book: " + (raw.bid === null ? "no bid." : "no ask."));
  }

  let freshness: QuoteFreshness;
  let ageSeconds: number | null = null;
  if (!raw.providerTime || (raw.last === null && book.state === "absent")) {
    freshness = "unavailable";
    reasons.push(raw.providerTime ? "No price in the quote." : "No provider time; age unknown.");
  } else {
    const ageMs = Date.parse(context.observedAt) - Date.parse(raw.providerTime);
    ageSeconds = Math.round(ageMs / 100) / 10;
    const maxAgeMs = context.policy.freshnessSeconds * 1000 + (raw.delaySeconds ?? 0) * 1000;
    const active = raw.marketState === "REGULAR";
    if (ageMs < -maxClockSkewMs) {
      freshness = "unavailable";
      reasons.push("Provider time is more than 60 s ahead of the observation; clock error.");
    } else if (!active) {
      freshness = "closed_market";
      reasons.push(
        "Market state " + (raw.marketState ?? "unknown") + ": the last price is not live.",
      );
    } else {
      let stale: boolean;
      if (raw.bid !== null && raw.ask !== null && ageMs >= 0) {
        const verdict = analytics.stale({
          symbol: raw.symbol,
          providerTime: raw.providerTime,
          observedAt: context.observedAt,
          active,
          maxAgeMs,
          bid: raw.bid,
          ask: raw.ask,
        });
        stale = verdict.stale;
        if (stale) reasons.push("Stale-quote detector: " + verdict.reasons.join(", ") + ".");
      } else {
        // Without a two-sided book the detector does not apply; the same budget is
        // enforced here and labeled as the application rule.
        stale = ageMs > maxAgeMs;
        if (stale) reasons.push("Application age rule: older than " + maxAgeMs / 1000 + " s.");
      }
      freshness = stale ? "stale" : (raw.delaySeconds ?? 0) > 0 ? "delayed" : "live";
      if (freshness === "delayed")
        reasons.push("Exchange data delayed by " + raw.delaySeconds! / 60 + " min.");
    }
  }

  const change =
    last !== null && previousClose !== null ? Number((last - previousClose).toFixed(10)) : null;
  return {
    id: context.id,
    cycleId: context.cycleId,
    symbol: raw.symbol,
    instrumentId: context.instrumentId,
    source: context.source,
    observedAt: context.observedAt,
    providerTime: raw.providerTime,
    marketState: raw.marketState,
    delaySeconds: raw.delaySeconds,
    quoteUnit: raw.quoteUnit,
    reportedLast: raw.last,
    last,
    bid: price(raw.bid),
    ask: price(raw.ask),
    bidSize: raw.bidSize,
    askSize: raw.askSize,
    open: price(raw.open),
    high: price(raw.high),
    low: price(raw.low),
    previousClose,
    volume: raw.volume,
    change,
    changePercent:
      change !== null && previousClose ? Number(((change / previousClose) * 100).toFixed(6)) : null,
    book,
    freshness,
    ageSeconds,
    reasons,
    sourceHash: context.sourceHash,
    policy: quotePolicyVersion,
  };
}
