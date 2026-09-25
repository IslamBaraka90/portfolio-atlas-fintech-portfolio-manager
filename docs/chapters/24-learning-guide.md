# Chapter 24 — what would this order have cost at the market's actual prices?

Chapter 12 filled paper orders from authored opening events: someone typed a price and a capacity. The live desk offers each accepted order its live quote instead, and keeps every Chapter 12 control in place.

## The fill model (`chapter-24.quote-fill.v1`)

`quoteFill` turns a quote into an opening event:

- Only **live** or **delayed** quotes fill. A closed market waits for the next open cycle; a stale or missing quote waits too.
- A fresh two-sided normal book fills buys at the **ask** and sells at the **bid**.
- A one-sided, locked, crossed or absent book uses the last trade plus a stated half-spread (5 bps), labeled **modeled** and rounded away from the trader to the tick grid. 100.05 + 5 bps is 100.1000025, so a modeled buy is 100.11; a modeled sell at 99.9999975 is 99.99.
- Quantity is capped by the displayed size on the relevant side when Yahoo reports it, otherwise by the remaining quantity.

The result is an ordinary Chapter 12 `opening` event with a `live` evidence block (quote id, time, bid, ask, midpoint, basis, displayed size). `PaperExecutionService` applies the unchanged rules: lot rounding, tick validation, the 5% reference band, protected market orders, limit crossing, partial fills and residuals, cumulative fees, cash reservations and one ledger posting per fill. Only the fill's `source` changes, to `live_quote_paper_fill`.

## Protection is the lesson

Chapter 12 reserves cash at the approved decision price and rejects a protected market order whose opening price is worse. With live quotes the ask usually sits above the last trade, so **a live proposal must be priced at the executable side**: the ask for buys, the bid for sells. The order then fills at that price if the quote holds. If the ask moves above the decision price before the fill, the order is rejected by protection instead of filling at a worse price than was approved. The API test walks the demo price forward until this happens.

Each order and quote pair has one event id (`lq<trade>-<quote>`) and one command key, so replaying a cycle over the same quote cannot fill twice.

## Execution cost

`executionCost` is written as application arithmetic and labeled so, rather than borrowed from a package topic whose contract differs:

- shortfall = Σ quantity × (fill − decision) for buys, Σ quantity × (decision − fill) for sells; positive is a cost;
- spread cost = Σ quantity × |fill − recorded midpoint|;
- total = shortfall + fees, and total bps = total ÷ (filled quantity × decision) × 10,000.

Buying 10 at 100.10 against a 100.00 decision with a 100.05 midpoint and 1.00 in fees: shortfall 1.00, spread cost 0.50, total 2.00, 20 bps.

## Walkthrough

Price a rebalance at the ask, approve it, submit it in **Paper execution** and accept the orders. Open **Live fills** and select **Offer live quotes**. In market hours the blotter shows ask fills with their quote times; when closed, the cycle note says the orders wait. The cost table compares each order with its decision price. The live cycle runs fills before valuation, so the same cycle's NAV includes them.

## Recording sequence

Quote → ask fill → replay without a second fill → closed-market wait → modeled price on a crossed book → quote moves above the decision → protection rejection → cost table.

Chapter 25 measures the live portfolio's performance and records a demo cache that replays offline.
