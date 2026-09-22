# Chapter 13 — deferred settlement and reconciliation contract

## Two distinct clocks and balances

Existing immediate-teaching fills retain their historical policy. New paper batches can select an immutable authored settlement policy. Its UTC calendar has explicit date coverage, business weekdays, holidays and business-day lag (0–5). Lag zero still requires an explicit settlement acknowledgment. Nonbusiness trade dates roll to the next eligible day before counting lag. No real market's legal settlement cycle is inferred.

A deferred buy recognizes investment cost and fee expense against a trade payable. Cash stays at the custodian until settlement; the payable reduces available cash. A deferred sell removes FIFO lots and recognizes gain/fee against a receivable. Unsettled sale proceeds cannot fund a buy.

Economic cash = settled cash + receivables − payables. Available cash = settled cash − order reservations − payables. NAV uses economic cash plus economic holdings, so settlement alone changes neither NAV nor investment performance. Position quantity is trade-date exposure; signed pending quantity is incoming minus outgoing securities. Custody quantity = economic quantity − signed pending quantity.

Settlement consumes a positive quantity no larger than the remaining obligation, on/after its configured due date. Allocate remaining cash proportionally with half-even cents; final settlement consumes every residual cent. Failure is an immutable memo with a reason; retry can later settle. Duplicate source references cannot post cash twice. Pending buys cannot be resold; splits wait until affected obligations settle.

Manual book edits and new rebalances wait while deferred obligations remain. An operations acknowledgment updates its owning active paper batch checkpoint and revision in the same transaction. This allows a settled funding sale to finance the batch's remaining buys. Stale order commands must reload. This is a bounded single-writer workflow, not a concurrent institutional settlement engine.

## Statements and breaks

Import explicitly synthetic custodian JSON, with source reference, as-of time, selected paper-trade lines, full settled positions/cash and corporate-action receipt lines. Preserve immutable revisions. A reconciliation freezes one statement revision, journal checkpoint and selected batch revisions. No totals are manufactured from the source statement to make it match.

Match stable fill IDs first. An absent ID may match only one instrument/side/trade-date candidate. Multiple candidates or repeated use of a fill remain ambiguous; a statement line cannot clear multiple fills. Check quantity, net cash, fee, currency, trade/value dates. Also compare full settled cash/positions and receipt evidence references. Cash tolerance is zero cents; quantity tolerance is zero. Unknown source coverage and missing lines remain breaks.

Breaks retain expected and observed values, source references and candidate IDs. A resolution proposal records owner, evidence and reason. Approval can acknowledge a statement follow-up or execute an explicit latest-event reverse/repost correction. The original discrepancy is immutable. A corrected record still requires a fresh reconciliation; approving a resolution never silently declares its arithmetic matched.

## Package boundary and evidence

Installed fintech-algorithms 0.13.2 has neither D43 nor D30. Calendar, obligations and exact matching are authored application rules. Existing D12 order analytics remain in their adapter; no nonexistent settlement API is inferred.

Independent acceptance cases: a ten-share deferred buy, nine settled and one pending; cash remains funded and NAV unchanged by transfer. A completed ten-share custody record versus nine on a statement produces a one-share break. A configured holiday moves the due date; T+1 is not universal. An explicit reverse/repost of a latest erroneous cash event retains both journals and the resolution reference.
