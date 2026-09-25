# Chapter 25 — how did the live portfolio do, and can someone else replay it?

The last chapter closes the loop: measure what the live portfolio earned without counting deposits, freeze a daily record, hold real listings honestly, and let anyone replay a recorded session offline.

## Performance with Chapter 15 rules

`LivePerformanceService` takes the last NAV point of each exchange session date (up to 30 sessions, always ending with the latest point) and passes those live valuations to the Chapter 15 `PerformanceService`. Time-weighted return, investment profit and the flow boundaries come from there, so a deposit changes NAV without counting as return. With valuations on two sessions and no flows, TWR is NAV₂ ÷ NAV₁ − 1, which the API test checks independently.

The benchmark comparison uses final daily closes of `LIVE_BENCHMARK` on or before the first and last linked sessions: a price return, labeled as such. Active return is TWR minus that price return. With fewer than two sessions the measurement says why and stays empty.

## One report per session

After each completed session (the cycle that covers it), the service freezes one Chapter 16 report titled `End of day YYYY-MM-DD`. It references the live valuation, the Chapter 23 monitor and the Chapter 15 performance. Reports keep their approval and supersession rules. A second cycle for the same session reuses the stored report instead of creating another.

## Holding real listings (`chapter-25.live-identity.v1`)

The teaching book admits only synthetic-verified instruments. In live mode the book uses a named policy instead: provider-observed equities and ETFs may be held when their quote currency and unit scale are established. The ledger keeps the instrument snapshot, so the observed, not legally verified, identity stays visible. Rebalancing and paper execution still require evidenced tick size, lot size and sector (Chapters 9–12), which Yahoo does not supply, so those workflows remain on evidenced instruments. Live mode also enables Yahoo instrument search, so a learner can save a real listing and hold it.

## The demo cache (`chapter-25.demo-cache.v1`)

- `LIVE_CACHE_RECORD=.data/demo-cache/session.json` wraps the active quote and bar providers and writes every reply, plus a manifest with the SHA-256 of the cache, the recorded time range and the symbols.
- `DEMO_CACHE_PATH=...` replays it. The server clock starts at the recording's first observation and runs in real time. Quotes replay symbol by symbol from the latest recorded batch at or before the clock, so a differently ordered watchlist still gets the same rows.
- A cache whose bytes no longer match its manifest is refused before any replay.

The API test records a two-cycle session, replays it in a fresh workspace and gets the same NAV points, holdings, cash and mark times. Changing one byte makes the replay refuse. Recorded Yahoo data stays under ignored `.data/` paths for local replay; it is not redistributed.

## A real session, end to end

With `MARKET_DATA_MODE=live`, a portfolio that deposited 10,000 USD and bought 10 AAPL at 200 was valued before the open at the prior close of 335.92: NAV 8,000 + 3,359.20 = 11,359.20, complete. Risk had a full 60-return window. Its 0.025 beta was checked by hand: AAPL's 60-session beta to SPY was 0.085 (correlation 0.033), times a 30% weight. The monitor declined to judge a close more than an hour old.

## Recording sequence

Two session closes → TWR → benchmark and active return → end-of-day report frozen once → observed listing admitted in live mode → record a session → replay offline → one changed byte refused.

Part V ends here. Specialist assets, streaming vendors and brokerage connectivity remain extensions.
