# Chapter 15 — performance definitions

## Frozen valuations and flows

Select 2–100 immutable valuations in nondecreasing as-of and journal-checkpoint order for one portfolio/currency. Each must be complete and reconciled. A pair must advance time or checkpoint. External flows are only recorded deposits (positive into the portfolio) and withdrawals (negative). The opening checkpoint already includes opening capital. Trades, dividends and settlement acknowledgments are internal.

Flows are selected by journal sequence between adjacent checkpoints, never guessed from changes in NAV. Require their occurredAt within the corresponding valuation interval. Foreign-currency flows need an explicit event-time FX policy; this version reports unavailable. Corrections/reversals inside the requested interval require a separate restatement workflow and are unavailable.

## Return methods

For each interval whose external flows all occur at the ending valuation instant, r = (ending NAV − end flows) / beginning NAV − 1. A post-flow valuation gives the same immediate pre-flow value by subtracting the recorded flow. Every external-flow instant must be an endpoint for exact TWR. Link factors geometrically: product(1+r) − 1. An immediate 500 deposit from 10,095 to 10,595 therefore returns zero even at the same timestamp. Zero/negative beginning capital and missing flow boundaries are unavailable.

Modified Dietz is an explicitly approximate alternative: (end − start − sum flows) / (start + sum(time-remaining fraction × flow)). Actual elapsed milliseconds supply weights; require positive elapsed time and positive denominator. Net results include all book costs and received income. The fee-added-back TWR adds only recorded standalone and trade fees to each interval numerator; it is a named arithmetic comparison, not a reconstructed investable gross strategy. Foreign fee currencies make this comparison unavailable. Taxes and accrual entitlements are not modeled.

Money-weighted return solves investor cash flows: negative opening NAV, negative external deposits, positive withdrawals and positive ending NAV. Solve in period-growth log space using actual elapsed time / total period. Scan period rates from -0.999999 to 1000 with 2048 brackets, bisect sign changes, report residual and iterations. Same-time flows aggregate. One sign change permits a unique headline only if a root is found. Nonconventional signs always report ambiguity even if the scan sees one or no roots: tangent/out-of-range roots are not excluded. No root, zero duration and exhausted bounds are explicit. Annualized IRR is secondary and emitted only for at least 365 elapsed days using actual/365.

Money remains decimal through accounting and ratios; the IRR numerical boundary requires absolute flows/NAV at most one billion. Short histories have period returns, not annualized headlines.

## Benchmark and attribution

A daily Chapter 6 benchmark comparison requires complete gross-total-return evidence, same base currency, exact start/end session dates and UTC end-of-day valuation cutoffs (23:59:59.999Z). Intraday snapshots cannot silently match daily closes. Portfolio return is net of recorded fees; benchmark is gross reinvested with no tax/cost, and both labels stay visible.

The one-period authored sector laboratory uses three-effect Brinson–Fachler:
allocation = (portfolio weight − benchmark weight) × (benchmark sector return − total benchmark return);
selection = benchmark weight × (portfolio sector return − benchmark sector return);
interaction = weight difference × sector-return difference.
Weights are beginning weights and each side sums to one. Active return is weighted portfolio return minus weighted benchmark return; residual = active − sum(effects), tolerance 1e-10. This is an explicit synthetic sector example, not inferred account attribution. An optional performance reference must have matching currency/dates and net TWR matching the supplied sector aggregate within tolerance; otherwise linkage is incompatible. Multi-period linking, currency and factor attribution are unsupported.

## Evidence sources and applicability

Installed 0.13.2 lookup finds no D16 domain or matching TWR/IRR/Brinson exports. Implement the scoped application formulas above rather than importing an unrelated statistic.

The [GIPS calculation methodology](https://www.gipsstandards.org/standards/gips-standards-for-firms/gips-standards-handbook-for-firms/) supports distinguishing exact flow-boundary TWR from time-weighted-flow approximations. This application does not claim GIPS compliance.

[CFA Institute's performance attribution literature review](https://www.cfainstitute.org/sites/default/files/-/media/documents/book/rf-lit-review/2019/rflr-performance-attribution.pdf) describes arithmetic allocation, selection and interaction approaches. [Microsoft XIRR documentation](https://support.microsoft.com/en-us/excel/functions/xirr-function) describes irregular-dated cash flows and iterative solving; our bounded period-return solver and diagnostics are explicitly different from a claim of Excel parity.
