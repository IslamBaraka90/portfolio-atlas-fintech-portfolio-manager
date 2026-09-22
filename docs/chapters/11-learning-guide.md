# Chapter 11 — from weights to quantities

## Walkthrough

Create a Chapter 9 equal-weight target for the funded two-instrument teaching portfolio. Open **Rebalance review**, select that target and the latest complete valuation. For unheld AURA/HARB, explicitly use authored current teaching prices of 100.

At 10 bps, the conservative sizing buffer produces **39 shares each**. Purchases total 7,800; fees total 7.80. Closing available cash is **2,192.20**, and post-fee NAV is **9,992.20**. Every position, sector, cash, cost and turnover constraint is checked on that resulting book.

Inspect before/target/after weights and residual drift. Approve the proposal: revision 2 records approval and the actual ledger remains unchanged. Replaying the same API command returns the same result. A later deliberate UI submission starts a new command; an uncertain network retry retains its key.

Change the trigger to a future calendar time: no trades and no approval. Change the actual portfolio book after creating a fresh proposal: approval fails with a revision conflict. A newer valuation, changed instrument revision or 15-minute expiry also requires rebuilding.

## Sales and lots

For an overweight holding, the ordered proposal sells before buying. Each sale names FIFO lots, removed basis and gross book gain. Same-time acquisitions keep journal order; final disposal consumes all remaining basis cents.

The D14 comparison shows oldest-first and lowest-score alternatives with explicit missing policy evidence. Example: ten shares with basis 50 versus basis 120, sale price 100, coefficient 0.2. Lowest-score selects the latter and scores −40. Settlement cash from that score is **zero**. This does not establish deductible loss or permitted tax-lot identification; executable accounting stays FIFO.

A new contribution reduces the need to sell. Cash-flow-first makes purchases only and shows any remaining concentration breach. An already-balanced 40/40/20 book generates no trades or fees even if the fee assumption is positive.

## Implementation path

Read the [definition contract](11-definition-contract.md), contracts/rebalancing.ts, plan-rebalance.ts, FintechLotScoringEngine, RebalanceService and RebalanceDesk. The API exposes POST/GET /rebalances, GET /rebalances/:id?revision=N and POST /rebalances/:id/approval with expectedRevision.

Video sequence: derive quantities and fees → show the cash bridge → inspect post-fee limits → show FIFO versus an illustrative score → approve → invalidate evidence → hand off to paper execution.

The planner is deterministic greedy sizing under whole-lot synthetic same-currency rules. It is not a global optimizer. Jurisdictional taxes, fractional execution, live broker orders and delayed-settlement financing are outside this chapter's execution contract.
