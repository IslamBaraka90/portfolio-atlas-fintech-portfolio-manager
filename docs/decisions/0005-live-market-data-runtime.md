# ADR 0005 — Live market-data runtime for Part V

Status: accepted for Chapters 18–25 on the `enhancements` branch.

## Context

Chapters 1–17 teach every portfolio decision on deterministic synthetic data. Yahoo observations can be ingested, but downstream chapters deliberately refuse them: rows have unknown finality, identity and tick size, FX is an authored constant, and paper fills use authored opening events. Part V turns the same desk into a live, local portfolio manager without weakening those contracts.

## Decision

1. **One explicit runtime mode.** `MARKET_DATA_MODE=demo | live` (default `demo`). Demo serves the synthetic fixtures (and later a recorded demo cache). Live registers the Yahoo Finance v4 providers and the refresh scheduler. The server never switches mode by itself, and every record keeps its `source`.
2. **Learner-selected refresh cadence.** `LIVE_REFRESH=eod | 15m | 5m | 1m` (default `eod`). The cadence sets the scheduler period, the provider cache TTL and the freshness thresholds together, so a one-minute schedule is never served a sixty-second cache.
3. **Polling, not streaming.** Yahoo Finance v4 is an unofficial request/response client. The server polls on the configured cadence through a queued request budget and pushes each completed cycle to the browser with server-sent events. The browser never calls Yahoo.
4. **Freshness is evidence.** Every quote, bar, FX rate and mark records provider time, observation time, exchange delay, market state and a freshness verdict. A stale or closed-market value remains visible and is labeled; it is never replaced silently or filled with zero.
5. **Live trust is a named policy.** Yahoo rows become usable downstream only through a versioned live-provider policy that states which synthetic guarantees are replaced by which observed checks (session-calendar finality, inferred tick size, identity observation). Synthetic lessons keep their stricter policy.
6. **Local only.** The API stays on loopback. Provider responses, caches and live-derived reports stay under ignored `.data/` paths. The project does not redistribute Yahoo data.
7. **Paper only.** Live quotes drive a paper broker. No brokerage connection, order routing or account credentials are introduced.

## Consequences

- Default tests remain deterministic: live behavior is tested with fake transports and a controllable clock. Live smoke checks are separate, opt-in scripts.
- Exchange holidays are not supplied by Yahoo. The session calendar models regular weekday hours per exchange timezone and labels holidays and half days as unknown rather than asserting them.
- Live history is still not point-in-time evidence. Backtests continue to carry a dataset suitability verdict.
- Specialist assets, streaming vendors and brokerage connectivity remain extensions.
