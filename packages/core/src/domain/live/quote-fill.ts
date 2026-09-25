import type {
  ExecutionCost,
  LiveFillEvidence,
  PaperOrder,
  QuoteObservation,
} from "@portfolio-atlas/contracts";
import { BookDecimal as D } from "../accounting/decimal.js";

export const quoteFillPolicy = "chapter-24.quote-fill.v1";
export const defaultHalfSpreadBps = 5;

// Fill model chapter-24.quote-fill.v1:
// - only live or delayed quotes fill; a closed market or a stale quote waits;
// - a fresh two-sided normal book fills buys at the ask and sells at the bid;
// - otherwise (one-sided, locked, crossed or absent book) the last trade plus a
//   stated half-spread (default 5 bps) is used and labeled `modeled`, rounded away
//   from the trader to the tick grid;
// - quantity is capped by the displayed size on the relevant side when reported,
//   otherwise by the remaining quantity; the Chapter 12 lot, tick, 5% protection
//   band and partial-fill rules then apply unchanged.
export function quoteFill(
  order: Pick<PaperOrder, "side" | "tickSize" | "remainingQuantity">,
  quote: QuoteObservation | undefined,
  halfSpreadBps = defaultHalfSpreadBps,
):
  | { action: "fill"; price: string; capacity: number; live: LiveFillEvidence }
  | { action: "wait"; reason: string } {
  if (!quote) return { action: "wait", reason: "No live quote for this instrument yet." };
  if (quote.freshness === "closed_market")
    return { action: "wait", reason: "Market closed: the order waits for the next open cycle." };
  if (quote.freshness !== "live" && quote.freshness !== "delayed")
    return { action: "wait", reason: "Quote is " + quote.freshness + "; no paper fill." };
  if (!quote.providerTime) return { action: "wait", reason: "Quote has no provider time." };
  const buy = order.side === "buy";
  const tick = new D(order.tickSize);
  const side = buy ? quote.ask : quote.bid;
  let price: InstanceType<typeof D>;
  let basis: LiveFillEvidence["basis"];
  if (quote.book.state === "normal" && side !== null) {
    price = new D(side);
    basis = buy ? "ask" : "bid";
  } else if (quote.last !== null) {
    const move = new D(quote.last).mul(halfSpreadBps).div(10_000);
    const raw = buy ? new D(quote.last).plus(move) : new D(quote.last).minus(move);
    // Round away from the trader so the model never flatters the fill.
    const steps = raw.div(tick);
    price = (buy ? steps.ceil() : steps.floor()).mul(tick);
    basis = "modeled";
  } else return { action: "wait", reason: "No usable bid, ask or last trade." };
  const size = buy ? quote.askSize : quote.bidSize;
  const displayed = basis !== "modeled" && size !== null && size > 0 ? size : null;
  const capacity = Math.min(1_000_000, displayed ?? Math.ceil(Number(order.remainingQuantity)));
  return {
    action: "fill",
    price: price.toDecimalPlaces(8).toFixed(8),
    capacity,
    live: {
      policy: quoteFillPolicy,
      quoteId: quote.id,
      symbol: quote.symbol,
      providerTime: quote.providerTime,
      freshness: quote.freshness,
      basis,
      bid: quote.bid,
      ask: quote.ask,
      midpoint: quote.book.midpoint,
      last: quote.last,
      halfSpreadBps: basis === "modeled" ? halfSpreadBps : 0,
      displayedSize: displayed,
    },
  };
}

// Execution cost per order, written explicitly as application arithmetic:
// shortfall = Σ quantity × (fill − decision) for buys, Σ quantity × (decision − fill)
// for sells; spread cost = Σ quantity × |fill − midpoint| where a live midpoint was
// recorded; total = shortfall + fees; bps against the decision notional.
export function executionCost(order: PaperOrder): ExecutionCost {
  const sign = order.side === "buy" ? 1 : -1;
  const decision = new D(order.protectionPrice);
  let shortfall = new D(0),
    spread = new D(0),
    spreadKnown = false;
  for (const fill of order.fills) {
    const qty = new D(fill.quantity);
    shortfall = shortfall.plus(qty.mul(new D(fill.price).minus(decision)).mul(sign));
    const mid = fill.live?.midpoint ?? null;
    if (mid !== null) {
      spreadKnown = true;
      spread = spread.plus(qty.mul(new D(fill.price).minus(mid).abs()));
    }
  }
  const filled = new D(order.filledQuantity);
  const fees = new D(order.fees);
  const total = shortfall.plus(fees);
  const decisionNotional = filled.mul(decision);
  return {
    orderId: order.id,
    instrumentId: order.instrumentId,
    side: order.side,
    filledQuantity: order.filledQuantity,
    decisionPrice: order.protectionPrice,
    averageFill: order.averagePrice === null ? null : new D(order.averagePrice).toFixed(8),
    shortfall: shortfall.toDecimalPlaces(2).toFixed(2),
    spreadCost: spreadKnown ? spread.toDecimalPlaces(2).toFixed(2) : null,
    fees: order.fees,
    totalCost: total.toDecimalPlaces(2).toFixed(2),
    totalCostBps: decisionNotional.isZero()
      ? null
      : total.div(decisionNotional).mul(10_000).toDecimalPlaces(2).toFixed(2),
    liveFills: order.fills.filter((f) => f.source === "live_quote_paper_fill").length,
    method: "application arithmetic; chapter-24.quote-fill.v1",
  };
}
