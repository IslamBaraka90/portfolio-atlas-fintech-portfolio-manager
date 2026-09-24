# PRP 23 — Live risk and alerts

Status: planned. Part V. Chapter: 23. Editorial duration estimate: 15 minutes.

## Learner question and result

**Has the live portfolio drifted into a risk we said we would not accept?**

Recompute risk measures on live history and the live NAV series each cycle, run the Chapter 14 monitor automatically, and push alerts without duplicating them.

## Prerequisites

Chapter 8 risk models, Chapter 14 monitor and alert lifecycle, Chapters 20 and 22 live history and NAV.

## Sources and conventions

Verify each export with the lookup script before use:

- `volatility-and-covariance/covariance-estimation/ewma-covariance` (verified);
- `foundations/financial-risk-and-performance-statistics/beta-and-market-relative-risk` (verified);
- `foundations/financial-risk-and-performance-statistics/active-return-and-tracking-error` (verified);
- existing drawdown and value-at-risk intuition topics (D00).

Daily simple returns from final daily closes only; forming bars never enter risk inputs. Annualization 252. Beta versus `LIVE_BENCHMARK`.

## Scope

Rolling EWMA volatility per holding and portfolio, beta and tracking error against the benchmark, live drawdown from the NAV series, and the existing concentration, cash and drift rules. Monitor runs are triggered by the cycle but reuse the Chapter 14 freshness gate, so a stale cycle cannot resolve a breach.

## Contracts

`LiveRiskSnapshot { cycleId, asOf, window, holdings[{ instrumentId, ewmaVolatility, beta }], portfolio{ volatility, beta, trackingError, drawdown }, inputs, tiers }`. Alerts reuse `RiskFinding` with `trigger: live_cycle`.

## Tasks and commits

1. `chapter-23 task-1: compute live risk measures on final bars to keep forming prices out of risk`.
2. `chapter-23 task-2: run the monitor on each live cycle to evaluate limits continuously`.
3. `chapter-23 task-3: push deduplicated alerts to the desk to make breaches visible once`.
4. `chapter-23 task-4: build the live risk panel to show measures beside their inputs`.

## Acceptance cases

- [ ] Beta of a series against itself is 1; tracking error of identical series is 0.
- [ ] A forming bar changes nothing in the risk snapshot.
- [ ] A breach repeated across ten cycles yields one finding with ten observations.
- [ ] A stale cycle cannot resolve an open breach.
- [ ] Each number states its package tier.

## Validation execution

Independent fixtures, dedup replay tests, API stream tests, and a demo-mode browser journey.

## Video

A single holding rallies past its concentration limit mid-session; follow the alert from cycle to acknowledgment.

## Handoff

Continuously monitored live risk. Chapter 24 lets the paper broker trade at live quotes.
