# Chapter 12 — follow the order

## Walkthrough

Approve a Chapter 11 proposal, open **Paper execution**, select the approval and submit a protected-market batch. Each order begins submitted. Accept the first order and inspect reserved cash: a 39-share buy protected at 100 with 10 bps fees reserves **3,903.91**, including a one-cent rounding allowance.

Simulate an authored opening at 100 with capacity 4. Filled shares become 4, remaining shares 35, fee 0.40 and remaining cash commitment **3,503.51**. The journal records one actual trade. Request cancellation: state becomes cancel_pending and the commitment remains. Acknowledge it: cancelled, commitment zero, four acquired shares remain.

For another order, accept then supply an opening of 101 against buy protection 100. Protected market rejects and releases its reservation. A limit order would remain open without a fill. Daily high/low touches do not prove intrabar execution.

The opening button supplies a hypothetical price/capacity and records the current time. This is authored paper evidence, not a retrieved Yahoo trade, exchange opening or live broker execution.

## Replay and races

The connected browser test commits a fill, discards the response, then retries the same event. Only four shares reach the book. The UI retains the uncertain event body and exposes **Retry last event**; **Reload paper state** retrieves current server state.

Independent API case: quantity 10 at 390, fills 4 then 6. Fees are 1.56 then 2.34, totaling 3.90; cash becomes 6,096.10 and quantity is exactly 10. A cancel request between fills can lose the race to the second fill. Its later acknowledgment does not reverse a completed trade.

A database trigger deliberately fails a fill after reservation release begins. The transaction rolls back both cash and order changes. Retrying succeeds once. A disk database restart retains the batch, journal and duplicate-event result.

## Controls and boundaries

- An approval is consumed once; stable client IDs cannot describe different terms.
- Submission checks current approval, book, valuation, instrument, mandate and time evidence.
- Acceptance requires actual available cash. An unexecuted sale is not funding.
- Active batches lock manual writes for their portfolio. Cancel remaining orders before editing its book.
- Event IDs, expected revisions and ordered opening clocks prevent duplicate or stale transitions.
- Cumulative decimal fees avoid rounding each partial independently.
- FIFO accounting and immediate teaching settlement remain explicit.
- Replacing an order requires cancellation and a newly reviewed proposal.

Read the [definition contract](12-definition-contract.md), contracts/orders.ts, PaperExecutionService, the package analytics adapter and OrderDesk. POST /paper-batches submits; GET lists/reads; POST /paper-batches/:id/events applies an event. Every mutation needs an idempotency key.

## Recording sequence

Submit → accept → show reservation → partial fill → inspect journal → lose and retry a response → cancel-pending → acknowledge → reject a protected market opening → show simulation limits.

Continue to Chapter 13 for explicitly configured deferred settlement and custody reconciliation. These Chapter 12 examples have already used immediate teaching settlement and must retain that historical label.
