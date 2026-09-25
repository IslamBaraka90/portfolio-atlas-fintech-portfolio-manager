import type { MarkEvidence, QuoteObservation } from "@portfolio-atlas/contracts";
import { BookDecimal } from "../accounting/decimal.js";

export const liveMarkPolicy = "chapter-22.live-mark.v1";

// Mark policy chapter-22.live-mark.v1, in order:
// 1. no quote for the holding's symbol, or a quote in another currency → unavailable;
// 2. live or delayed with a last trade → last;
// 3. live or delayed with no last trade but a normal or locked book → midpoint
//    (a crossed book never has a midpoint, see Chapter 19);
// 4. market closed → the last price, which is the session close, or the previous
//    close when no last price is reported;
// 5. stale or unavailable → unavailable. Nothing is carried forward past freshness.
// Prices are recorded with eight decimal places, the book's unit-price precision.
export function selectLiveMark(
  position: { instrumentId: string; currency: MarkEvidence["currency"] },
  quote: QuoteObservation | undefined,
): MarkEvidence {
  const base = {
    instrumentId: position.instrumentId,
    currency: position.currency,
    dataset: null,
    rowId: null,
    reviewId: null,
    override: null,
  };
  const unavailable = (reason: string, q?: QuoteObservation): MarkEvidence => ({
    ...base,
    price: null,
    status: "unavailable",
    quotedAt: q?.providerTime ?? null,
    observedAt: q?.observedAt ?? null,
    sourceHash: q?.sourceHash ?? null,
    reasons: [reason, ...(q?.reasons ?? [])],
    quoteId: q?.id ?? null,
  });
  if (!quote)
    return unavailable(
      "No live quote for this holding. Save it through Instrument discovery so it is quoted.",
    );
  if (quote.quoteUnit.currency !== position.currency)
    return unavailable(
      "Quote currency " +
        (quote.quoteUnit.currency ?? "unknown") +
        " differs from the book currency " +
        position.currency +
        ".",
      quote,
    );
  let price: number | null = null;
  let basis: MarkEvidence["basis"];
  let reason = "";
  if (quote.freshness === "live" || quote.freshness === "delayed") {
    if (quote.last !== null) {
      price = quote.last;
      basis = "last";
      reason = "Last trade from a " + quote.freshness + " quote.";
    } else if (
      quote.book.midpoint !== null &&
      (quote.book.state === "normal" || quote.book.state === "locked")
    ) {
      price = quote.book.midpoint;
      basis = "mid";
      reason = "No last trade; midpoint of a " + quote.book.state + " book.";
    }
  } else if (quote.freshness === "closed_market") {
    price = quote.last ?? quote.previousClose;
    basis = "close";
    reason =
      quote.last !== null
        ? "Market closed: the last price is the session close."
        : "Market closed: previous close.";
  }
  if (price === null || basis === undefined)
    return unavailable("No acceptable live price (" + quote.freshness + ").", quote);
  return {
    ...base,
    price: new BookDecimal(price).toDecimalPlaces(8).toFixed(8),
    status: "accepted",
    quotedAt: quote.providerTime,
    observedAt: quote.observedAt,
    sourceHash: quote.sourceHash,
    reasons: [reason + " (" + liveMarkPolicy + ", quote " + quote.id + ")"],
    basis,
    quoteId: quote.id,
  };
}
