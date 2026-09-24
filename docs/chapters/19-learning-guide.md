# Chapter 19 — is this price live, delayed or stale?

A price without its age is an opinion. This chapter replaces the Chapter 18 provider probe with real work: every refresh cycle quotes the watchlist and the saved instruments, validates each quote at the boundary and stores it on an append-only tape.

## From Yahoo to an observation

`YahooQuoteProvider` makes one batched `quote()` call per cycle through the Chapter 18 budget. It disables the library's whole-batch result validation and validates each row with zod instead, so one drifted symbol becomes an explicit `unavailable` observation rather than discarding the batch. `mapYahooQuote` is the only place Yahoo field names appear:

- `regularMarketTime` becomes `providerTime`; epoch seconds and `Date` both map to an ISO instant.
- `exchangeDataDelayedBy` is in minutes and becomes `delaySeconds`.
- A zero bid or ask is Yahoo's placeholder for an absent side and becomes `null`, never a price.
- `GBp`/`GBX` quotes keep `reportedLast` and are scaled by 0.01 into GBP, with the Chapter 2 unit evidence.

In demo mode, `SyntheticQuoteProvider` quotes the four teaching instruments deterministically per minute, so screenshots and tests replay.

## The freshness policy

`classifyQuote` applies `chapter-19.quote-freshness.v1` in order:

1. No provider time or no price: **unavailable**.
2. Provider time more than 60 s ahead of our observation: **unavailable** (clock error).
3. Market state other than `REGULAR`: **closed_market**. The last price is a close, not live.
4. Older than the freshness limit plus the exchange's declared delay: **stale**.
5. A declared exchange delay: **delayed**. Otherwise **live**.

The delay extends the budget because it is expected: under `5m` (600 s freshness), a London quote with a 15-minute delay is delayed at 20 minutes and stale at 40. For two-sided books, staleness comes from the fintech-algorithms stale-quote detector (D01-F02-A04, contract tier), with each quote evaluated as its own single-event session. A one-sided quote cannot use the detector, so the same budget is applied and labeled as the application rule.

Book state uses the crossed/locked detector (D01-F02-A06, contract tier) on the reported prices and the tick implied by `priceHint`. Spread and midpoint come from quoted spread (D11-F02-A01, verified tier). A crossed book keeps its prices but withholds spread and midpoint.

## Tape, board and watchlist

`QuoteService` stores every observation once (`live-quote`), archives the raw response by SHA-256, and appends a revisioned board with the latest observation per tracked symbol. The board is published on the event stream as a `quotes` event. The watchlist is revisioned too: stale edits return 409, duplicates are refused, and removed symbols leave the board but stay on the tape. Instruments saved in Instrument discovery are quoted automatically and carry their permanent `instrumentId`.

## Walkthrough

Open **Live quotes**. Select **Refresh quotes**, then add `ZZZ` in demo mode and refresh again: it appears as unavailable with the provider's reason. Open the tape for AURA to see every stored observation with its policy version and raw-archive hash. With `MARKET_DATA_MODE=live`, add `VOD.L` to see pence scaling and the 15-minute exchange delay.

## Recording sequence

Raw Yahoo row → unit scaling → delay budget boundary (20 vs 40 minutes) → closed market → crossed book → missing symbol → tape and board → watchlist conflict.

Chapter 20 extends history to intraday bars and admits live rows through a named provider policy.
