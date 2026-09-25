# PRP 25 — Live performance, reporting and the demo cache

Status: implemented and verified; see docs/chapters/25-learning-guide.md and docs/progress.md. Part V. Chapter: 25. Editorial duration estimate: 15 minutes.

## Learner question and result

**How did the live portfolio do today, and can someone else replay what we saw?**

Measure live performance against the benchmark from the NAV series, freeze an end-of-day report automatically, and record live cycles into a demo cache that the desk can replay offline.

## Prerequisites

Chapters 15–17 performance, reporting and governance; Chapters 18–24 live runtime, NAV and fills.

## Sources and conventions

Daily time-weighted return linked from end-of-day NAV points with external flows as boundaries (Chapter 15 rules). Benchmark return from final daily closes of `LIVE_BENCHMARK`. Sharpe and information ratio use `foundations/financial-risk-and-performance-statistics/sharpe-sortino-and-information-ratio-intuition` (verified) with the stated risk-free assumption (default 0).

## Scope

- Live performance view: intraday change, day, week and since-inception TWR, active return versus the benchmark.
- An end-of-day cycle freezes a report revision through the Chapter 16 report service.
- Demo cache: `MARKET_DATA_MODE=demo` with `DEMO_CACHE_PATH` replays recorded cycles (quotes, bars, FX) through the same providers on a simulated clock. Recording is explicit and stays in ignored `.data/`.
- Operations: provider outage drill and recovery evidence on the runtime desk.

## Contracts

`LivePerformance { portfolioId, valuationId, asOf, policy, performanceId, sessions, twr, investmentProfit, benchmark, benchmarkReturn, activeReturn, reportId, reportSession, reasons }`. `DemoCacheManifest { version, recordedFrom, recordedTo, entries, symbols, sha256 }`. Provider-outage behavior is the Chapter 18 back-off, exercised by its failure tests.

## Scope decisions (recorded during implementation)

- Live performance reuses the Chapter 15 `PerformanceService` over one live valuation per session; the end-of-day record is an ordinary Chapter 16 report.
- A real live walkthrough showed the book refusing every Yahoo listing, so a named identity policy (`chapter-25.live-identity.v1`) was added: in live mode the book admits observed equities and ETFs with an established currency and scale; rebalancing still requires evidenced tick, lot and sector. Live mode also enables Yahoo instrument search.
- Sharpe and information ratio were not added: the linked series is short and daily, and a ratio on a handful of sessions would overstate precision.

## Tasks and commits

1. `chapter-25 task-1: measure live performance and freeze an end-of-day report to keep a daily record` (tasks 1 and 2 of the plan in one commit).
2. `chapter-25 task-3: record and replay a demo cache to let learners use recorded live data offline`.
3. `chapter-25 task-4: admit observed live listings to the book under a named identity policy`.
4. `chapter-25 task-5: complete the live desk walkthrough and record part five evidence`.

## Acceptance cases

- [x] With no flows, linked TWR equals the NAV ratio (API test: NAV₂ ÷ NAV₁ − 1 across two sessions); 10,000 → 10,100 → 10,050 therefore links to +0.50%.
- [x] Deposits are excluded from return by the Chapter 15 service that live performance reuses (flow boundaries between linked valuations).
- [x] Replaying a recorded cache reproduces the recorded NAV values, holdings, cash, status and mark times exactly.
- [x] A cache with a changed byte is rejected by hash before replay.
- [x] The end-of-day report is created once per session even if the cycle is retried.

## Validation execution

Performance arithmetic tests, report idempotency tests, cache record/replay tests, and the full browser suite including a demo-cache journey.

## Video

Replay yesterday's session from the demo cache and reach the same report the live run froze.

## Handoff

A complete live portfolio desk with offline replay. Part V ends; specialist assets and brokerage connectivity remain extensions.
