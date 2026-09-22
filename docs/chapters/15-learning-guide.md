# Chapter 15 — separate growth from deposits

## Walkthrough

Create an opening Chapter 6 valuation, record an external deposit, then create a second valuation. In **Performance & attribution**, select that portfolio and both snapshots. The desk sorts the path by as-of and checkpoint; the API independently validates chronology, currency, portfolio and revisions.

The connected case moves NAV from 10,095 to 10,595 after a 500 deposit. Investment profit and TWR are both zero. The return index stays at 100 and the orange marker identifies the flow. A single immediate flow recorded after its economic timestamp can bridge API latency only when it is the sole journal event, the endpoints are within 60 seconds, marked holdings and FX evidence are identical, and NAV changes by exactly that flow.

## Compare methods

The deterministic API fixture then charges 105.95 against 10,595: net return is -1%, while the named recorded-fee add-back comparison is zero. Fees remain in the journal. Gross strategy reconstruction, interest on hypothetical retained fees and tax are not inferred.

Exact TWR needs valuation boundaries at external flows (or the verified immediate bridge). Missing boundaries make TWR unavailable; Modified Dietz stays a labeled approximation when weighted capital and duration are valid. A midpoint deposit of 100 into opening NAV 100 and ending NAV 220 gives Dietz 20 / 150 = 13.3333%. Linked +10% and -10% subperiods produce -1%, not zero.

Investor cash-flow signs are opposite portfolio funding signs. The bounded money-weighted solver reports roots, sign changes, residual, iterations and search bounds. The independently authored -100, +230, -132 example at start/midpoint/end has period-return roots 21% and 44%; no headline is selected. A one-day 10% period result has no annualized headline. No-root and zero-duration states stay explicit.

A benchmark must match currency, gross-total-return convention and exact daily endpoints with UTC end-of-day valuation cutoffs. Intraday or price-only mismatch is visible; the portfolio net-cost and benchmark gross-cost labels remain separate.

## Attribution laboratory

The default authored example uses portfolio sector weights 60/40 and benchmark weights 50/50. Sector portfolio returns are 12% and 4%; benchmark returns are 10% and 5%. Portfolio return is 8.8%, benchmark return 7.5%, active return 1.3 percentage points.

Three-effect Brinson-Fachler attribution gives allocation 0.5 points, selection 0.5 points and interaction 0.3 points, with zero residual. Beginning weights and one-period arithmetic are explicit. Selecting a performance link checks dates, currency and supplied portfolio aggregate; a mismatch persists as incompatible instead of presenting the example as account attribution.

## Evidence and limitations

Read the [definition contract](15-definition-contract.md). Installed 0.13.2 has no D16 or matching TWR/IRR/Brinson exports. These are bounded application calculations with independent examples; no unrelated package method is substituted.

Source valuations, interval journal events, external and investor flows, benchmark result and method reasons are frozen. Foreign external-flow FX, correction restatements, tax/accrual inference and multi-period/factor attribution remain unsupported. Prior performance snapshots remain unchanged after later events.

## Recording sequence

Naive NAV growth → identify deposit → flow-adjusted index → fee effect → missing boundary and Dietz → IRR ambiguity → benchmark mismatch → sector effects and residual → reject a false account linkage.

Chapter 16 assembles consistent management reports from these frozen results and earlier chapter evidence.
