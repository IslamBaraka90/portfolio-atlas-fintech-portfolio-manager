# Chapter 12 — paper order lifecycle contract

## Simulation and state machine

An approved Chapter 11 proposal is consumed once into a batch. Each proposed trade keeps its order, instrument, quantity and protection price. clientBatchId and derived clientOrderId are stable and unique. One active batch locks manual book writes in that portfolio; this bounded single-writer policy protects both sell quantities and cash. Other portfolios remain usable.

Orders start submitted. An explicit broker acceptance atomically reserves buy cash or marks sell quantity committed. Sells can be accepted first to finance later buys under Chapter 5 immediate teaching settlement. A buy without current funding remains submitted with an error; projected proceeds are never reserved as existing cash.

States: submitted → accepted → partially_filled → filled. Submitted/accepted/partial can enter cancel_pending. Cancel acknowledgment releases remaining resources and becomes cancelled. A fill may race ahead of acknowledgment while cancel_pending, leaving cancel_pending if incomplete or filled if complete. An acknowledgment after complete fill is a recorded no-op. Rejected orders release only their own valid reservation. Replacing an order requires cancellation and a newly reviewed proposal; queue-priority replacement is not claimed.

Each event has a unique ID and expected batch revision. Exact repeated event IDs return their original result; conflicting IDs, stale revisions and invalid transitions fail before posting. Events and all release/fill/re-reserve journal entries share one SQLite transaction. Restart preserves them.

## Opening-event model

The user supplies an explicitly authored paper opening price, time and available whole-lot quantity. It is a hypothetical opening slice of a daily-bar model, not a Yahoo trade or an observed market fill. Its time must be later than acceptance and no later than the server clock. No high/low touch is sufficient evidence of an intrabar limit fill; no queue priority or path is inferred.

The proposal price is the protection price. A buy fills only at or below it; a sell only at or above it. Prices must be on tick and within a 5% reference band. A protected market order outside protection is rejected; a limit order remains open with a no-fill event. Within protection, fill quantity is min(remaining, authored opening capacity), floored to its evidenced lot. Zero capacity cannot fill.

Cumulative fee = half-even cents(cumulative actual notional × fee bps / 10,000). Each fill posts only the increment since prior fees, avoiding per-partial double rounding. Buy reservations cover remaining protected notional, remaining fee bound and one cent rounding allowance. Release old reservation → post trade → reserve remaining commitment is atomic.

Freshness, instrument/mandate revisions and approval are checked at submission. Acceptance and fills check current policy and expiry again. The batch tracks the expected journal checkpoint. Cancellation remains available after policy changes so resources can be released. Partial execution is visibly transitional and does not assert final portfolio compliance.

## Package calls and accounting boundary

0.13.2 D12-F03-A01 `tickSizeValidation` uses safe integer atoms, price scale 100,000,000 and an explicit synthetic tick policy. Output `valid`, remainder and reason are checked. D12-F04-A03 `partialFillResidual` returns `cumulative_quantity`, `leaves_quantity`, `average_fill_price` and per-fill states. Catalog prose lists older names; installed output owns the contract. Both methods are shared-fixture verified, separately tested against independent examples.

The application supplies brokerage orchestration and atomic persistence. Decimal cash, actual fees and FIFO lots remain in the book; floating package averages are descriptive. This chapter keeps immediate teaching settlement. Later deferred custody operations must introduce explicit obligations and financing restrictions without relabeling these already-settled examples.
