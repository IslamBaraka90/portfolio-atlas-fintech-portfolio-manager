# Chapter 9 — Targets are proposals with constraints

## Input identity and clocks

A construction request names a portfolio, its current mandate revision, one exact risk-model revision and one exact valuation revision. All snapshots are immutable. The valuation must belong to that portfolio, be complete with positive NAV, and use the same currency as the mandate and risk model. Its book checkpoint is retained.

All positive existing holdings must be represented in the ordered risk universe; unknown holdings cannot disappear from turnover. Current weights come from decimal base-currency position values / NAV and aggregate cash / NAV, converted to finite numbers only at the analysis boundary. The current weights, including cash, must already sum to one within 10^−12. No holdings or book events are changed.

Only simple-return models are supported for construction. Annual means and annual covariance travel together. Log-return models remain inspectable in Chapter 8 but require an explicit future conversion policy before use here.

## Methods, cash and uncertainty

The [method inventory](09-method-inventory.md) names actual installed imports and the four D14 families.

Equal weight, minimum variance and inverse volatility allocate a fixed risky sleeve of 1−cashWeight. Requested cash is on the Chapter 1 basis-point grid; computed asset weights retain solver precision. Minimum variance is optimal only for its declared risky simplex and cash reserve. Inverse volatility is a rule, not a covariance-aware optimum.

Turnover-constrained Markowitz uses an appended cash coordinate with zero annual return and zero covariance. Cash is endogenous, then checked against the mandate. Its objective is annual expected return − lambdaRisk × annual variance. Its half-L1 cap includes cash, matching the package definition.

volatilityStress multiplies every standalone volatility by a selected positive factor and covariance by its square. This creates a named input sensitivity scenario; it never rewrites the original risk snapshot. Means remain unchanged. It is not a forecast of a market event.

## Feasibility and status

Continuous candidate weights are audited at absolute tolerance 10^−8; they are not rounded into Chapter 1's manual-entry grid to manufacture compliance. Record observed value, limit and signed slack for budget, long-only, cash floor/ceiling, position cap, aggregated sector cap, eligibility/restrictions, turnover and estimated cost.

Use proposal only when the method succeeded and every applicable constraint passes. A proposal is not an order or approval. Unknown sector/identity evidence prevents proposal status. A failed candidate is candidate_rejected, not a claim that every possible portfolio is infeasible. No clipping, renormalization or silent relaxation is allowed.

A simple preflight can prove infeasibility when cash bounds conflict, fixed cash is outside its allowed range, or the maximum known eligible sector/position capacity plus permitted cash is below one. Unknown data is unsupported rather than a proof of infeasibility. Iteration exhaustion, invalid solver input and numerical failure remain solver_failed. No failed state becomes executable.

## Costs and turnover

Current-to-target turnover = 0.5 × sum of absolute changes over risky assets plus cash. Risky traded notional = sum of absolute risky-asset changes. These are different quantities when cash changes.

Estimated cost fraction = risky traded notional × estimatedCostBps / 10,000. Enforce its selected maximum and require enough proposed cash to cover it. Costs are a disclosed post-calculation estimate, not a hidden term in the selected objective. Target weights are before costs. Chapter 11 constructs quantities and fees, checks financing, and re-evaluates post-cost allocations.

The request and UI retain all these conventions. Realized execution costs are unknown here.

## Risk explanation

Portfolio variance uses the verified D00 quadratic-form method on annual covariance, augmented with zero-risk cash. Variance contribution i = w_i × (Sigma w)_i. Contributions sum to variance; individual contributions may be negative. Risk share divides by variance and is null for zero variance. Expected return is the weighted annual assumption with zero cash return. Report contract-tier D14 provenance separately from the verified D00 diagnostic.

Independent tests cover equal-variance symmetry, asymmetric 8/11 optimum, inverse-volatility 2/3, turnover-boundary 0.7, permutation, invalid/indefinite inputs, exhausted iteration budgets, mandate capacity, unknown evidence and no-order behavior.
