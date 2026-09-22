# Chapter 11 — target to trade contract

## Frozen teaching policy

A proposal uses a successful Chapter 9 target, current reconciled book, latest complete same-currency valuation and current mandate/instrument revisions. A contribution after target creation is allowed when a new valuation includes it. Target age is at most 24 hours; valuation and price evidence at most one hour; proposal expires after 15 minutes. Approval rechecks the book checkpoint, latest valuation, mandate, instrument revisions and expiry. Approval creates no orders.

Only synthetic verified whole-lot instruments in the base currency are executable. Held prices come from the selected valuation. New positions require explicit teaching price overrides with source, time, currency and reason. Prices must fit the instrument tick; quantities floor to its evidenced lot size. Fractional quantities inherited from the book may remain as residuals; they are not rounded up or silently discarded.

Triggers: manual, calendar (caller-supplied due time), drift (largest absolute current/target weight gap, including cash), or cash-flow-first. Cash-flow-first buys underweight assets without sales. Other triggered plans first sell overweight holdings, then buy underweight holdings in stable instrument-ID order. This deterministic greedy planner is not a globally optimal trading algorithm.

Desired quantities use a conservative cost buffer: target weight × starting NAV × (1 − 2 × fee rate), floored to lots. This covers two sides of risky notional under the bounded long-only universe, while the final audit uses exact fees. Small trades below the supplied minimum are omitted. Buy budgets also protect reserved cash and the mandate floor against starting NAV. Fees use half-even cents. Sell proceeds may fund later buys under the existing immediate teaching settlement; the later settlement chapter must explicitly control delayed proceeds.

All proposed fills are replayed through the existing book. Revalue every resulting position at frozen prices, report actual post-fee weights and residual drift, and audit position/sector/cash/cost/turnover limits. Failed candidates remain reviewable but cannot be approved. No clipping or basis-point rounding can hide a breach.

## Lots and D14 boundary

Book execution remains FIFO in journal order, including same-time acquisitions. A sale preview exposes quantity and proportional cent-rounded basis removed from each lot; final disposal takes its remaining cents. This exactly matches Chapter 5.

Installed 0.13.2 D33/D34 are absent. D14-F04-A05 was looked up: `scoreFixedSale` compares oldest-first and lowest-score fills for a fixed sale. It supports multiple lots and returns fill sequence, capacities, score and policy evidence. Its `optimizeTaxAwareTrade` oracle instead supports exactly two assets and one lot each, so it is not a general rebalance planner.

The adapter compares illustrative lot scores using an explicitly supplied coefficient. Score = coefficient × (1 − basis / price) × sale dollars. This is not a tax liability, refund, deduction or cash credit. Jurisdiction and identification evidence are absent and displayed as missing. Lowest-score ranking never changes the executable FIFO proposal. Contract-tier output is labeled; exact book arithmetic is separately tested.

Primary API source: installed declarations and [D14 contract](https://docs.thefintechbuilder.com/portfolio-construction/practical-constraints/tax-aware-portfolio-optimization/index.md). The rules above are authored educational policies, not legal or trading advice.
