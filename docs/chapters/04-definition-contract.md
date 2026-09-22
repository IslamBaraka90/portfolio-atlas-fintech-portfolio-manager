# Chapter 4 — Separate adjustment and currency effects

## Definition before implementation

A backward 2-for-1 split adjustment divides every pre-event price by 2 and multiplies pre-event volume by 2. Post-event prices are unchanged. This is a historical research transformation; no holdings or cash are posted. The [SEC investor explanation](https://www.investor.gov/introduction-investing/investing-basics/glossary/stock-split) describes the corresponding share/price relationship.

The gross dividend research method reinvests at the ex-date close. With ex-date close P and cash dividend D, the backward factor is P / (P + D). Multiplying earlier prices by that factor reproduces the link (P + D) / priorClose - 1. It is not the alternative subtraction approximation (priorClose - D) / priorClose. For a prior close of 52, ex-date close 50 and dividend 2, the total return is zero and the backward factor is 50/52. Dividend accounting remains separate: never add a dividend credit to returns already incorporating it. [SEC dividend timing](https://www.investor.gov/introduction-investing/investing-basics/glossary/ex-dividend-dates-when-are-you-entitled-stock-and) distinguishes the ex-date from payment and record dates.

## Bounded scope and ordering

The authored case has one 2-for-1 split on September 3, 2026 and a later ordinary USD dividend on September 8. At most one supported split is applied, followed by the dividend method on the common post-split share basis. A dividend before/on a split, multiple splits, rights, spin-offs, special distributions, tax withholding and cross-currency dividends return unsupported reasons until their own policy is implemented. Missing volume blocks this package split call rather than being filled with zero.

All source rows must be accepted, dates unique and the supplied synthetic session coverage complete before a derived contiguous series is published. The application rejects ambiguous provider-returned basis. adjclose remains a separate untouched observation. No already-adjusted derived series can be submitted as a raw parent.

## Clocks and revisions

The action knowledge cutoff selects the highest revision available at that cutoff; future revisions and cancelled events are explained. Yahoo candidates retain observedAt as the earliest evidence available to this app; historical announcement, record/payment dates, confirmation and currency authority are not invented.

This desk is current-price research with an action knowledge cutoff, not a historical backtest. Price observations were downloaded at the parent observedAt. Package observation availability is that timestamp; package asOf is the later of parent observation and the selected action cutoff. Only events eligible at the separately disclosed cutoff enter the calculation. A real point-in-time strategy must also possess contemporaneous price archives (Chapter 10).

The synthetic timeline includes a dividend revision from 2 to 2.5 available September 15 and cancellation available September 20. These authored events illustrate knowledge selection; they are not claims about a real issuer. A stored review preserves all revisions and parent source hash. Replaying the same command cannot apply an event twice. Each new adjustment run appends an immutable revision with parent, review, action revisions and method.

## FX convention

An observation states quote-currency units per one base-currency unit. USD/EUR at 0.90 means 1 USD = 0.90 EUR; USD 100 converts to EUR 90. Reverse conversion divides by 0.90. Unrelated currencies, future/unknown observations, nonpositive rates and observations older than the stated freshness budget are rejected. No silent reciprocal guessing or triangular path.

The [ECB reference-rate convention](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) explicitly names the base currency and treats reference rates as information. Our 0.90 is an authored teaching value, not an ECB/live rate. A constant-rate converted series is a currency scenario, not historical FX performance. Binary numbers here are research outputs; book money uses the Chapter 5 decimal policy.

## Verified installed contracts

fintech-algorithms 0.13.1, individually looked up and source-inspected:

- D02-F01-A01 calculate: prices, volumes, eventIndex, postSplitSharesPerPreSplitShare → adjustedPrices, adjustedVolumes, ratioConvention. Six-decimal output rounding.
- D02-F01-A03 calculate: explicit price currency, gross variant, latest_raw_close anchor, ordinary confirmed/cancelled event revisions and observations → adjustedPrices, cumulativeFactors, eventAdjustments, returnLinks, excludedEvents. Twelve-decimal published output.
- D01-F04-A06 detectAdjustmentBasisDrift: archived raw/adjusted pairs plus newly knowable action multipliers → row residuals and stable/expected-restatement/basis-drift states.
- D02-F04-A05 reconcileCorporateAction was inspected; this bounded review has one evidence source per event, so no authority-ranking claim is made.

The imported methods are verified tier: paired implementation fixture parity, not independent validation. Hand-derived split, dividend and FX cases remain mandatory.
