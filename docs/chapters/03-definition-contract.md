# Chapter 3 — Daily observation and quality contract

## What acceptance means

A row is accepted for this lesson's price analytics only when identity matches, the timestamp belongs to the requested UTC window, its session date is unique and ordered, OHLC geometry and positive finite equity prices pass, volume is nonnegative when present, and finality is evidenced. Missing volume remains a warning for price-only analytics; volume analytics must reject it. Zero volume remains zero. Both copies of a duplicate session are quarantined.

Daily time is the provider event instant; session date is derived in the reported IANA exchange timezone. Invalid dates retain their raw row and a null/invalid normalized timestamp. The window is [from 00:00 UTC, to 00:00 UTC), maximum 366 days. We never manufacture weekend or holiday slots from weekday arithmetic.

## Package boundary

Pinned fintech-algorithms 0.13.1: D01-F02-A01 exports validateBars; D01-F04-A01 exports diagnoseGap. Both are contract tier, requiring independent application tests. Installed source and lookup were inspected before implementation.

validateBars multiplies OHLC by priceScale; tickSize is in the resulting currency units. This lesson uses known instrument tickSize multiplied by quote-unit scale, zero tolerance ticks, and explicit scale. Unknown tick size skips the package call and quarantines the row; the package default 0.01 is never used. Application checks supplement the package: positive prices, volumes, duplicates, order, symbol, window, units, finality and future observations.

Gap classification receives only evidenced statuses. The authored calendar defines expected synthetic sessions; missing rows have unknown halt/transport evidence and stay unknown. Yahoo has no authoritative full-session calendar in this adapter, so expected coverage is unknown. No missing slot becomes a zero return.

## Evidence and finality

Yahoo v4 chart returns nullable OHLCV and separate adjclose. Raw means the serialized SDK response, not an original HTTP wire capture. SHA-256 identifies that exact archived JSON. Archives are local and ignored by Git. Dataset revisions retain instrument revision, request, source hash, observation time, units and quality policy.

Yahoo OHLC basis remains provider_returned. adjclose is never substituted for close or OHLC. Historical finality and historical data availability are not established by a current download; Yahoo rows remain unknown-finality and quarantined until stronger evidence exists. Synthetic completed-session evidence is explicit. Identity, tick, calendar, adjustment and availability limits remain visible.

Retries are explicit user retries with an idempotency key. Transient failures are not cached as success; one click never issues an unbounded retry loop. Successful cache hits keep their original observation time. Empty results are visible zero-coverage datasets, never invented candles.

## Sources

- [Yahoo chart module](https://github.com/gadicc/yahoo-finance2/blob/devel/docs/modules/chart.md), checked against installed 4.0.2 declarations.
- [Provider integration guide](https://docs.thefintechbuilder.com/guides/data-providers/), checked against installed package source.
- Installed package lookup and source are the executable API authority. Authored finality/calendar policies are teaching assumptions, not provider guarantees.
