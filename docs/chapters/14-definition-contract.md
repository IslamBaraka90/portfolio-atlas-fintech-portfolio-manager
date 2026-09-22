# Chapter 14 — monitoring definitions

## Exposure and scenarios

Use a complete, positive NAV in the portfolio base currency. Current positions use trade-date economic quantity; custody differences remain operational evidence. Weight is base market value / NAV. Sector and currency exposures aggregate those values; currency includes economic cash. Unknown sectors remain UNKNOWN. Current mandate limits use strict greater-than breaches: equality passes. Cash floor uses strict less-than.

Optional Chapter 9 target weights provide current drift and proposed exposure/scenario comparison. Hypothetical shock is a parallel local equity/ETF price change with FX fixed and cash unchanged: position P&L = base market value × shock; portfolio P&L is their sum. No derivatives, nonlinear repricing or liquidity forecast is inferred.

## Historical illustration

Use exact aligned daily simple returns from a Chapter 8 risk model. Apply today's weights to every interval; cash earns zero. This is a hypothetical daily-reset constant-weight replay, not realized portfolio performance or a strategy backtest. Currency must equal the portfolio base; every held or proposed asset needs data. Log returns and partial coverage are unavailable.

D00-F11-A05 valueAtRiskIntuition sorts losses = negative returns and interpolates at zero-based index (n−1) × confidence. Confidence is 95%, horizon one supplied daily interval. The raw quantile can be negative when all observations gain; do not clamp it. D00-F11-A03 compounds from wealth 1 and reports negative drawdowns; expose positive loss fractions by negating them. Include initial wealth in the high-water mark. Tiny authored samples are demonstrations, not calibrated forecasts.

[NIST percentile methods](https://itl.nist.gov/div898/handbook/prc/section2/prc262.htm) explains why interpolation must be named; this app freezes the installed package's (n−1) convention. [CFA Institute market risk definitions](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/measuring-managing-market-risk) distinguishes confidence/horizon and methods. VaR is a quantile, never a maximum possible loss.

Installed 0.13.2 lookups: D00-F11-A03 and A05, verified shared-fixture parity. Actual declarations/source own returned fields. Numeric conversion is bounded to absolute NAV/position values at most 1 billion; decimal accounting stays unchanged.

## Fixed teaching rule revision 1

Position/sector/cash rules use the current mandate revision. Drift > 5 percentage points, historical maximum drawdown > 20%, and historical one-interval VaR > 5% raise findings. These are authored review thresholds. They are not suitability or regulatory limits. Quantities equal to a limit pass within 1e-10 floating-point comparison tolerance.

Current freshness requires the valuation's book checkpoint to match the book, complete evidence, and cutoff/held mark/FX times no more than one hour old. Stale observations are unavailable and cannot clear risk. Missing history/target makes that metric unavailable. Liquidity is explicitly unavailable without a participation policy and sufficient validated volume.

Finding identity includes portfolio, rule, subject, mandate revision and chapter policy. Repeated breach updates the existing finding. Acknowledge/escalate keeps the financial state. Resolve needs a fresh passing observation for that same identity from the latest monitor run and an unchanged book. No stale or missing result clears a finding. Resolved findings reopen on a new breach. All lifecycle actions require expected revision, actor and reason; immutable revisions and history persist.
