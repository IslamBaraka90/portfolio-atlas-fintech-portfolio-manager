# Chapter 23 — has the live portfolio drifted into a risk we said we would not take?

Chapter 8 estimated risk from frozen samples and Chapter 14 monitored a valuation someone chose. The live desk does both on its own, once per new valuation, without letting a forming bar or a stale price change the answer.

## Inputs that do not move every tick

`alignDailyCloses` keeps only final, accepted daily closes from Chapter 20. Series are aligned on dates present for every holding and the benchmark. Dates dropped by alignment are counted and reported, because a missing date turns the neighbouring return into a two-session return. The window is the latest 60 simple returns, and at least 3 are required.

The benchmark is `LIVE_BENCHMARK`: SPY in live mode and the synthetic ETF ATLS in demo mode. It is always tracked, so its quotes and bars exist even if nobody watches it.

## Measures (`chapter-23.live-risk.v1`)

| Measure                          | Method                                                              | fintech-algorithms topic (tier)             |
| -------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| Holding and portfolio volatility | EWMA covariance (λ 0.94) over holdings and benchmark, √(w′Σw × 252) | D10-F04-A02 EWMA covariance (verified)      |
| Beta                             | Sample covariance with the benchmark over its variance              | D00-F11-A07 beta (verified)                 |
| Tracking error                   | Annualized standard deviation of portfolio minus benchmark returns  | D00-F11-A09 active return and TE (verified) |
| Drawdown                         | From the live NAV series; negative fractions from the running peak  | D00-F11 drawdown (verified)                 |

The EWMA topic needs at least two columns, so the benchmark column is always part of the estimate; portfolio variance uses the holdings block only. Weights are today's values of NAV applied to past sessions, a hypothetical estimate and not realized performance. The screen says so. Verified means shared-fixture parity with the catalog's Python implementation.

## The monitor, unchanged

After estimating, `LiveRiskService` runs the Chapter 14 monitor on the same valuation with an idempotency key per valuation. The monitor keeps its rules: one finding per breach, updated rather than duplicated; a changed book or evidence older than one hour cannot resolve a breach; acknowledgment does not make a risk vanish. The live desk reports breach, pass and unavailable counts, and findings are handled in **Monitoring & alerts**.

A valuation is assessed once. Cycles that change nothing produce no new valuation (Chapter 22) and therefore no new assessment.

## Independent checks

A holding identical to its benchmark has beta 1 and zero tracking error. NAV 10,000 → 10,100 → 9,595 has a −5% maximum drawdown. Appending a forming bar at 180 leaves every measure unchanged. In the API test, a portfolio that is about 89% cash breaches the demo mandate's cash ceiling; a new valuation a minute later is reassessed, and the finding count does not grow.

## Walkthrough

Open **Live risk**, choose a funded portfolio and select **Refresh risk**. Read the four measures, the monitor banner and the per-holding table, then follow the link to acknowledge the finding in Monitoring & alerts.

## Recording sequence

Forming bar excluded → alignment gap reported → beta 1 / tracking error 0 check → EWMA volatility → monitor breach → no duplicate finding on the next valuation.

Chapter 24 lets the paper broker fill orders at these live quotes.
