# Chapter 10 — causal validation contract

## Policy frozen before implementation

This is a bounded synthetic daily-bar experiment, not evidence of a profitable live strategy. The authored calendar has 16 sessions, two USD instruments, raw prices and no dividends or splits. Each bar has distinct open, close and availability times. Universe membership and a required filing have authored availability. Current provider datasets remain blocked for historical validation.

Three independent, cash-funded folds start at sessions 4, 8 and 12 (zero based). Each tests four sessions. Expanding training starts at zero; rolling training uses the previous four sessions. The final fold is the untouched holdout. No model selection uses its result. There are no overlapping forward labels, scalers, purging or significance claims. Repeated human experimentation can still overfit this tiny fixture.

At the last training close, compare each eligible instrument's training end/start simple price return. Allocate 80% to the highest score (stable ID tie break), otherwise hold cash. The comparison baseline allocates 40% to each currently eligible asset. These are isolated policy experiments, not execution of a present-day Chapter 9 target. Applying current targets retrospectively would leak current evidence.

Decision time follows bar availability. Buy at the next authored open; whole shares floor the 80% budget using that open. This is a market-on-open sizing model with cash budget, not a quantity decided at the previous close. Fees = rounded notional × basis points / 10,000, expensed by the existing FIFO journal. No spread, market impact, queue priority or borrowed funds are modeled. Each fold starts with USD 10,000, holds through its final close and includes unrealized value; no terminal sale or exit cost is implied.

A delisted fixture stays in the historical universe. At its authored removal open an existing position receives a forced cash liquidation at the explicitly supplied recovery price. It is then ineligible. This is one positive-recovery teaching scenario, not a universal delisting policy.

NAV uses Chapter 6 decimal valuation of Chapter 5 reconciled books. Fold return = final NAV / initial cash − 1. Drawdown includes initial capital, then each close. Cost sensitivity repeats the exact experiment at zero, requested and twice requested fees. Independent fold results are never presented as one continuous funded return.

## Evidence and sources

- [QuantConnect research guide](https://www.quantconnect.com/docs/v2/writing-algorithms/key-concepts/research-guide): bias and modeling considerations; our timing and sizing rules above are authored.
- [TimeSeriesSplit](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html): chronological training/test separation; no Python dependency or claim that the app calls it.
- Installed fintech-algorithms 0.13.2 D40 has score-validation methods, not a general backtester.
- D00-F11-A03 `drawdownAndMaximumDrawdown`, from the documented drawdown subpath, consumes aligned returns/benchmark and frequency; outputs nonpositive drawdowns, maximumDrawdown and endingWealth. Shared-fixture verified tier. Benchmark values satisfy the shared parser, not an active-return calculation.

## Acceptance evidence

Future test prices must not change an earlier training decision. Late filings and missing expected sessions block before performance calculation. Same frozen fixture/configuration produces identical financial evidence. All generated journals remain isolated from the user's portfolio book. Full bars, membership, filing clocks, fitted scores, selected IDs, order/fill clocks, books and costs are retained.
