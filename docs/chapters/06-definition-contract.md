# Chapter 6 — Valuation and benchmark contract

## Scope and clocks

This chapter values the Chapter 5 long-only cash-funded equity/ETF book. NAV means total portfolio net assets, not a per-fund-share dealing price. Liabilities and unsettled receivables are zero under immediate teaching settlement. Reservations remain owned cash and are included once.

A valuation freezes portfolio ID, journal checkpoint, asOf knowledge time, accepted mark references, source hashes, action reviews, FX-run revisions, and policy version chapter-6.v1. asOf cannot be future or earlier than the recorded evidence in the selected book/datasets. Retrospective source history is current reconstruction; it does not become point-in-time evidence.

The selected checkpoint is rebuilt from its original event prefix, even when later corrections exist. The generated snapshot embeds that book. Replaying its request against the same references gives identical financial components.

## Mark hierarchy and share basis

1. An explicit manual teaching override has precedence only with a positive decimal price, currency, quote time, source reference and reason. It is visibly marked overridden and asserts a price in the current book share units.
2. Otherwise use the explicitly selected accepted unadjusted daily close from its immutable dataset and matching action review. Normalize quote subunits with decimal arithmetic.
3. Missing/rejected/unknown-basis prices remain unavailable. There is no zero or carried-forward fallback.

Quote time must be no later than asOf and no older than the declared freshness budget. The synthetic lesson defaults to ten calendar days, so the authored September history remains inspectable. This is an explicit teaching policy, not a trading freshness standard; the UI allows a stricter threshold.

Book splits after a quote invalidate that share basis. Known splits between acquisition and valuation require corresponding book evidence with matching action ID, date and ratio; unexplained book splits also invalidate the mark. Acquisition after the split needs no extra posting. A manual override explicitly assumes current book units and retains its reason.

Unknown live-provider action coverage does not become accepted synthetic evidence. This chapter's automatic valuation marks therefore use reviewed synthetic histories. Live Yahoo observations remain inspectable with their unresolved evidence from earlier chapters.

## Money and FX

Multiply quantity by normalized unadjusted price with decimal.js; half-even round each local holding value to cents. Convert each rounded local holding/cash amount to base currency, then half-even round to base cents. Aggregate those components exactly. Supported currencies have two decimal places in this teaching policy.

FX observations come from frozen Chapter 4 adjustment runs. Match the exact currency direction; use a reciprocal for the reverse direction. Reject future, stale or inconsistent observation/availability times. Use decimal arithmetic for conversion, preserving the provider's supplied numeric quote as its decimal string.

A missing holding price or FX rate makes its base value null and total NAV incomplete. Known subtotals stay visible. Coverage counts are by holdings/currencies, never misleading value-weight percentages when the missing value is unknown.

External capital is reported from contributed-capital journals, separately from dividend income and realized P&L. A deposit changes NAV but is not itself return. Chapter 15 supplies flow-adjusted performance.

Independent examples: 8,995 cash + 10 × 110 = 10,095; add 500 external capital = 10,595. USD 100 × 0.9 EUR/USD = EUR 90. Missing EUR/USD for EUR cash cannot produce a complete USD NAV.

## Benchmark definition

Freeze name, currency, return basis, constituent identities, immutable adjustment-run revisions and source hashes. The baseline assigns 1/N at the first common session, then buys and holds through the fixed history. It does not reset weights daily. Constituents remain unchanged over this authored history; future reconstitution is a new definition.

Price basis excludes ordinary dividend income. Gross total return reinvests ordinary dividends without withholding. Net-of-tax benchmarks require a separate policy and are not inferred. Source currency must match the declared benchmark currency; no guessed historical FX.

Use Chapter 4 ready runs with aligned dates and confirmed synthetic action coverage. Prices are split-adjusted for return calculations, distinct from the unadjusted marks used for actual share valuation. Dividend amounts align to ex-dates; the supported timeline has its split before dividends. The ordinary dividends are added once, never on top of an already total-return-adjusted price.

The package outputs six-place rounded return-index values. Preserve its output precision and use independent expectations within declared rounding tolerance. The adapter validates all finite values and aligned dimensions before calling it.

## Resolved package methods

Pinned version: fintech-algorithms 0.13.2. All methods below are verified against shared package fixtures, not independently certified.

| Topic       | Export / subpath suffix                                                              | Application use                                             |
| ----------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| D03-F02-A06 | calculate / index-and-benchmark-engineering/weighting-and-capping/equal-weight-index | Equal initial weights and cumulative buy-and-hold aggregate |
| D03-F04-A01 | calculate / index-and-benchmark-engineering/return-variants/price-return-index       | Price levels from split-consistent prices                   |
| D03-F04-A02 | calculate / index-and-benchmark-engineering/return-variants/gross-total-return-index | Gross dividend reinvestment levels                          |
| D00-F02-A06 | simpleReturn / foundations/financial-arithmetic-time-value-and-returns/simple-return | Positive start/end level ratio                              |

D00 simpleReturn additionally validates principal, rate and periods; pass explicit neutral values (0, 0, 1). No financial money arithmetic is delegated to binary floats. Benchmark index levels and fractional returns use finite checked numbers with a documented 1e-6 output tolerance.

Comparison checks require matching currency and price/gross-total-return convention. The desk exposes incompatible selections; it does not label a NAV change as portfolio performance.

## Primary references

- [Investor.gov NAV definition](https://www.investor.gov/introduction-investing/investing-basics/glossary/net-asset-value-nav): assets less liabilities. The app's restricted ledger has no liability model yet.
- [S&P methodology concepts](https://www.spglobal.com/spdji/en/research-insights/index-literacy/methodology-matters/): return type includes explicit income/reinvestment conventions.
- [S&P equal-weight index](https://www.spglobal.com/spdji/en/indices/equity/sp-500-equal-weight-index/): equal weighting is applied at rebalance dates. Our authored start-only baseline does not claim to replicate S&P's quarterly index.

These sources motivate definitions; Portfolio Atlas' marks, freshness and synthetic examples are application policy.
