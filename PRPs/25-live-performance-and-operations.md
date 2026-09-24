# PRP 25 — Live performance, reporting and the demo cache

Status: planned. Part V. Chapter: 25. Editorial duration estimate: 15 minutes.

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

`LivePerformance { portfolioId, asOf, periods[{ label, twr, benchmark, active }], ratios, tiers }`. `DemoCacheManifest { version, recordedFrom, recordedTo, cycles, symbols, sourceHashes }`.

## Tasks and commits

1. `chapter-25 task-1: measure live performance from the nav series to compare with the benchmark`.
2. `chapter-25 task-2: freeze an end-of-day report automatically to keep a daily record`.
3. `chapter-25 task-3: record and replay a demo cache to let learners use recorded live data offline`.
4. `chapter-25 task-4: complete the live desk walkthrough and record part five evidence`.

## Acceptance cases

- [ ] NAV 10,000 → 10,100 → 10,050 with no flows links to +0.50%.
- [ ] A 500 deposit between points is excluded from return.
- [ ] Replaying a recorded cache produces byte-identical NAV points to the recorded run.
- [ ] A cache with a changed byte is rejected by hash before replay.
- [ ] The end-of-day report is created once per session even if the cycle is retried.

## Validation execution

Performance arithmetic tests, report idempotency tests, cache record/replay tests, and the full browser suite including a demo-cache journey.

## Video

Replay yesterday's session from the demo cache and reach the same report the live run froze.

## Handoff

A complete live portfolio desk with offline replay. Part V ends; specialist assets and brokerage connectivity remain extensions.
