# Chapter 8 — Risk inputs and uncertainty

## Frozen conventions

The request order is the asset order for every price column, return column, mean vector and covariance row/column. Duplicate instruments are invalid. Require 2–8 equity/ETF histories, each a ready Chapter 4 adjustment run for the exact dataset/hash, all in the same known currency. Cross-currency histories need a future historical FX contract; constant demonstration FX is not accepted as currency risk.

Dates must match exactly, be strictly increasing, and contain at least three prices. Every source session must be accepted and accounted for. No pairwise deletion, intersection, imputation or compressed missing interval is allowed. Rows are daily trading-session intervals; weekends do not become invented observations. Input snapshots must be known by the cutoff. These are current research histories, not historical strategy evidence.

Price returns use split-adjusted closes. Gross-total-return research uses the Chapter 4 reinvested dividend series and adds no second dividend credit. All prices must be finite and positive, at most 10^12 currency units; scale normalization was frozen in Chapter 4. Returns use floating-point analysis, not monetary ledger arithmetic.

Simple return = end/start − 1. Log return = log(end/start). Both are explicit choices and never silently converted. Values are fractions, not percent integers. Annual covariance = daily covariance × selected sessions/year, default 252. Annual volatility is the square root of its diagonal. This scaling is an assumption about temporal dependence; it is not a promise about next-year realized risk.

## Expected-return assumption

Default expected returns are zero. Historical mean is an explicitly selected estimate: daily arithmetic sample mean × annualization, without compounding. Scenario inputs name every ordered instrument and specify annual returns in the selected simple/log convention. Historical mean estimates and user scenarios are not guaranteed forecasts. Downstream construction must check return convention and units.

## Installed methods

All selected methods are verified through shared-fixture parity in fintech-algorithms 0.13.2. Inspect declarations/source as well as the catalog; some captured examples omit rows.

| Quantity          | Export         | Subpath                                                                |
| ----------------- | -------------- | ---------------------------------------------------------------------- |
| Simple return     | simpleReturn   | foundations/financial-arithmetic-time-value-and-returns/simple-return  |
| Log return        | logReturn      | foundations/financial-arithmetic-time-value-and-returns/log-return     |
| Mean              | arithmeticMean | foundations/location-ranking-and-exploratory-summaries/arithmetic-mean |
| Sample covariance | calculate      | volatility-and-covariance/covariance-estimation/sample-covariance      |
| EWMA covariance   | calculate      | volatility-and-covariance/covariance-estimation/ewma-covariance        |
| Shrinkage         | calculate      | volatility-and-covariance/covariance-estimation/ledoit-wolf-shrinkage  |

The return functions receive neutral principal/rate/periods fields required by their shared parser.

Sample covariance centers each column and divides by n−1. EWMA uses the explicit zero-mean-return assumption, zero initial covariance, and C[t] = decay × C[t−1] + (1−decay) × r[t]r[t]'. Preserve the finite-window weight mass 1−decay^n and seed weight decay^n. Do not normalize away the seed or describe this as fitted EWMA.

The installed Ledoit–Wolf method uses centered maximum-likelihood covariance (denominator n), an identity target scaled by average variance, and estimated shrinkage clamped to [0,1]. It is not the constant-correlation target. Report its actual coefficient and target convention.

## Matrix boundary

Check dimensions, finiteness, symmetry and eigenvalues with a deterministic bounded Jacobi diagonalization for at most eight assets. Numerical tolerance is max(10^−14, max absolute cell × 10^−10). Negative eigenvalues below minus tolerance reject the matrix. No eigenvalue clipping or hidden repair occurs. Rank and condition number are diagnostic; singular PSD matrices may be valid descriptive estimates but are not positive definite. A downstream solver must establish its own admissibility.

Correlation is covariance / sqrt(var_i × var_j). A zero/numerically-zero variance produces null correlation rather than a fake zero. Report sample size relative to asset count and the short authored history. A ready risk estimate does not mean a stable allocation.

## Independent examples

Returns A = [0.1, −0.1, 0], B = [0, 0.1, −0.1] have zero means. Sample covariance is [[0.01, −0.005], [−0.005, 0.01]], correlation −0.5, and annual covariance at 252 sessions is [[2.52, −1.26], [−1.26, 2.52]]. Large annual volatility is expected from this deliberately exaggerated three-row teaching example.

Identical nonconstant series have correlation 1 and rank 1. Constant series have zero variance and undefined correlation. EWMA with decay 0.5 and rows [0.01,0.02], [−0.02,0.01] yields [[0.000225,−0.00005],[−0.00005,0.00015]], weight mass 0.75 and seed weight 0.25.

## Primary references

- [NIST sample mean and covariance matrix](https://www.itl.nist.gov/div898/handbook/pmc/section5/pmc541.htm) defines observations by row and covariance using n−1.
- [Ledoit and Wolf research](https://www.ledoit.net/honey.pdf) explains shrinkage toward a structured target and why the chosen target must be identified. Its constant-correlation example is distinct from the installed scaled-identity implementation.
- Installed D10 source/declarations define the precise finite-window EWMA and shrinkage algorithms used here.
