import {
  currencySchema,
  type Currency,
  type FxBoard,
  type LiveFxRate,
  type QuoteFreshness,
  type QuoteObservation,
} from "@portfolio-atlas/contracts";
import { BookDecimal } from "../accounting/decimal.js";

// Conventions (chapter-21.fx.v1):
// - a leg XXXUSD=X quotes USD per one unit of XXX (Yahoo convention);
// - a rate quotes `quote` currency per one unit of `base`;
// - direct: base→USD is the leg itself; inverse: USD→quote is 1 / leg;
// - cross via USD: base→quote = baseUSD / quoteUSD, timed at the older leg and as
//   fresh as its least fresh leg;
// - rates keep 10 significant digits; converted money rounds half-even to cents.
export const fxPolicyVersion = "chapter-21.fx.v1";
const supported = new Set<string>(currencySchema.options);
const rank: Record<QuoteFreshness, number> = {
  live: 0,
  delayed: 1,
  closed_market: 2,
  stale: 3,
  unavailable: 4,
};
export const legSymbol = (currency: string) => currency + "USD=X";

// Pairs needed to express every observed currency in every portfolio base currency.
export function requiredPairs(currencies: string[], bases: string[]) {
  const pairs: { base: Currency; quote: Currency }[] = [];
  const unsupported = [...new Set(currencies)].filter((c) => !supported.has(c));
  for (const quote of new Set(bases.filter((b) => supported.has(b))))
    for (const base of new Set(currencies.filter((c) => supported.has(c))))
      if (base !== quote) pairs.push({ base: base as Currency, quote: quote as Currency });
  return { pairs, unsupported };
}
// One leg per non-USD currency appearing in any pair.
export function requiredLegs(pairs: { base: string; quote: string }[]) {
  return [...new Set(pairs.flatMap((p) => [p.base, p.quote]).filter((c) => c !== "USD"))]
    .sort()
    .map(legSymbol);
}

export function deriveRates(
  pairs: { base: Currency; quote: Currency }[],
  legs: Map<string, QuoteObservation>,
  context: { observedAt: string; maxAgeSeconds: number; cycleId: string | null },
): Pick<FxBoard, "rates" | "unavailable"> {
  const rates: LiveFxRate[] = [];
  const unavailable: FxBoard["unavailable"] = [];
  for (const { base, quote } of pairs) {
    const used = [base, quote].filter((c) => c !== "USD").map((c) => legs.get(legSymbol(c)));
    const missing = used.some((q) => !q || q.last === null || !q.providerTime);
    if (missing || used.some((q) => q?.freshness === "unavailable")) {
      unavailable.push({
        base,
        quote,
        reason:
          "No usable " +
          [base, quote]
            .filter((c) => c !== "USD")
            .map(legSymbol)
            .join(" / ") +
          " quote; the pair is never converted at 1:1.",
      });
      continue;
    }
    const legQuotes = used as QuoteObservation[];
    const usd = (c: Currency) =>
      c === "USD" ? new BookDecimal(1) : new BookDecimal(legs.get(legSymbol(c))!.last!);
    const value = usd(base).div(usd(quote)).toSignificantDigits(10);
    const derivation =
      quote === "USD" ? "direct" : base === "USD" ? "inverse" : ("cross_usd" as const);
    const providerTime = legQuotes.map((q) => q.providerTime!).sort()[0]!;
    const freshness = legQuotes.map((q) => q.freshness).sort((a, b) => rank[b] - rank[a])[0]!;
    const legEvidence = legQuotes.map((q) => ({
      symbol: q.symbol,
      quoteId: q.id,
      usdPerUnit: new BookDecimal(q.last!).toString(),
      providerTime: q.providerTime,
      freshness: q.freshness,
    }));
    rates.push({
      base,
      quote,
      quotePerBase: value.toString(),
      derivation,
      legs: legEvidence,
      freshness,
      providerTime,
      observation: {
        id: "live-fx:" + base + quote + ":" + (context.cycleId ?? context.observedAt),
        baseCurrency: base,
        quoteCurrency: quote,
        quotePerBase: value.toNumber(),
        observedAt: providerTime,
        availableAt: context.observedAt < providerTime ? providerTime : context.observedAt,
        source:
          "Live FX " +
          derivation.replace("_", " ") +
          " from " +
          legEvidence.map((l) => l.symbol).join(" and ") +
          " (" +
          fxPolicyVersion +
          ").",
        maxAgeSeconds: context.maxAgeSeconds,
      },
      reasons: [
        ...(derivation === "cross_usd"
          ? ["Cross rate via USD; timed at the older leg."]
          : derivation === "inverse"
            ? ["Inverse of the " + legSymbol(quote) + " leg."]
            : []),
        ...(freshness === "closed_market"
          ? ["FX market closed: the last rate is a close, not live."]
          : freshness === "stale"
            ? ["A leg is stale; valuation will refuse this rate."]
            : []),
      ],
    });
  }
  return { rates, unavailable };
}

// Converts money with the board's evidence. Identity needs no rate. A missing or
// stale rate refuses the conversion; a closed-market rate converts with its label.
export function convertWithBoard(
  amount: string,
  from: Currency,
  to: Currency,
  board: FxBoard,
): { converted: string | null; rate: LiveFxRate | null; reasons: string[] } {
  const value = new BookDecimal(amount);
  if (!value.isFinite()) return { converted: null, rate: null, reasons: ["Invalid amount."] };
  if (from === to)
    return {
      converted: value.toDecimalPlaces(2).toFixed(2),
      rate: null,
      reasons: ["Same currency."],
    };
  const direct = board.rates.find((r) => r.base === from && r.quote === to);
  const inverse = board.rates.find((r) => r.base === to && r.quote === from);
  const rate = direct ?? inverse ?? null;
  if (!rate)
    return {
      converted: null,
      rate: null,
      reasons: [
        "No live rate for " + from + "→" + to + " on board revision " + board.revision + ".",
      ],
    };
  if (rate.freshness === "stale" || rate.freshness === "unavailable")
    return { converted: null, rate, reasons: ["The rate is " + rate.freshness + "; refused."] };
  const quotePerBase = new BookDecimal(rate.quotePerBase);
  const result = direct ? value.mul(quotePerBase) : value.div(quotePerBase);
  return {
    converted: result.toDecimalPlaces(2).toFixed(2),
    rate,
    reasons: [...(direct ? [] : ["Applied the stored rate inversely."]), ...rate.reasons],
  };
}
