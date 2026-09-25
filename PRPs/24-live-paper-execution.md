# PRP 24 — Paper execution at live quotes

Status: implemented and verified; see docs/chapters/24-learning-guide.md and docs/progress.md. Part V. Chapter: 24. Editorial duration estimate: 15 minutes.

## Learner question and result

**What would this order have cost at the market's actual prices?**

Let the Chapter 12 paper broker fill approved orders from live quotes, gate them by market hours, and report transaction costs against the decision price.

## Prerequisites

Chapters 11–13 proposals, paper orders, settlement and reconciliation; Chapters 19 and 22 quotes and marks.

## Sources and conventions

Fill model `chapter-24.quote-fill.v1`: buy at ask and sell at bid when fresh and uncrossed; otherwise last price plus a stated half-spread assumption (default 5 bps) labeled `modeled`; no fill when the market is closed or the quote is stale. Quantity is capped by displayed size when present, else by the existing capacity rule. Tick validation and partial-fill residuals reuse the Chapter 12 adapters.

TCA: implementation shortfall versus the decision (proposal) price, spread cost versus mid, and fees, using `execution-and-transaction-cost-analysis/cost-risk-optimization/implementation-shortfall-execution` only if its contract matches; otherwise the arithmetic is written explicitly and labeled as application code.

## Scope

Market and limit paper orders for long-only equities and ETFs during regular hours; orders submitted while closed wait for the next open cycle or expire under the existing policy. No brokerage routing.

## Contracts

Scope decision (recorded during implementation): Chapter 12 reserves cash at the decision price and rejects protected market openings above it, so live proposals are priced at the executable side (ask for buys). A quote that moves against the decision is rejected by protection; the tolerance is not loosened.

The opening event gains optional `live` evidence (`LiveFillEvidence { quoteId, symbol, providerTime, freshness, basis: ask|bid|modeled, bid, ask, midpoint, last, halfSpreadBps, displayedSize }`); fills record `source: live_quote_paper_fill` and the evidence. `ExecutionCost { orderId, side, decisionPrice, averageFill, shortfall, spreadCost, fees, totalCost, totalCostBps, liveFills, method }` via `GET /paper-batches/:id/costs`. `LivePaperService` runs as the `paper` task before valuation. Tasks 2 and 3 landed in one commit.

## Tasks and commits

1. `chapter-24 task-1: freeze the quote fill model to make paper fills reproducible`.
2. `chapter-24 task-2: fill paper orders from live quotes with market-hours gating`.
3. `chapter-24 task-3: report execution costs against the decision price to expose slippage`.
4. `chapter-24 task-4: render live fills and costs in the blotter`.

## Acceptance cases

- [x] Buy 10 with ask 100.10 and decision price 100.00 has a 1.00 shortfall before fees.
- [x] A crossed quote uses the modeled basis, rounded against the trader, and says so.
- [x] A closed market produces no fill and a waiting state with the reason.
- [x] Displayed ask size 3 fills 3 of 10 and leaves a residual of 7.
- [x] Replaying a cycle over the same quote creates one fill (event id and command key per order and quote).

## Validation execution

Model boundary tests, TCA arithmetic, API replay tests and a demo-mode browser journey with scripted quotes.

## Video

Submit the same order into an open and a closed market; compare the costs.

## Handoff

Live-priced paper fills. Chapter 25 measures and reports live performance and records a demo cache.
