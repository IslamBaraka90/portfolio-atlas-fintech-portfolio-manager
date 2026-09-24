# PRP 19 — Live quotes and freshness evidence

Status: planned. Part V. Chapter: 19. Editorial duration estimate: 15 minutes.

## Learner promise

**Is this quote tradable, delayed, stale or from a closed market?**

Poll Yahoo quotes for the watchlist and holdings, validate them at the boundary, classify their freshness and keep an append-only quote tape.

## Prerequisites and context

Chapter 18 runtime policy, refresh cycles and request budget; Chapter 2 instrument identity and quote units (GBp scaling).

Catalog connections (verify with `npm run algorithms:lookup -- show <slug>` before use):

- `market-data-engineering/cleaning-and-validation/stale-quote-detector` (`detectStaleQuotes`, contract tier);
- `market-data-engineering/cleaning-and-validation/crossed-locked-market-detector` (`classifyMarkets`, contract tier);
- `market-microstructure/liquidity-and-spreads/quoted-spread` (`quotedSpread`, verified tier).

## Scope and decisions

- One batched `quote()` call per cycle for all symbols (Yahoo v4 class API, `return: "object"`), under the Chapter 18 budget.
- `QuoteObservation` stores last, bid, ask, sizes, day OHLC, previous close, volume, `regularMarketTime`, `exchangeDataDelayedBy`, `marketState`, currency and scaled quote unit.
- Freshness verdict: `live`, `delayed`, `stale`, `closed_market`, `unavailable`, with reasons. Age is measured from provider time to observation time; delay is subtracted before judging staleness.
- Crossed or locked books and absent bid/ask are recorded; the mark policy (Chapter 22) decides what they mean.
- Missing numeric fields stay `null` with a reason; never zero.

## Contracts and interface

`QuoteObservation { id, cycleId, instrumentId, symbol, observedAt, providerTime, last, bid, ask, bidSize, askSize, open, high, low, previousClose, volume, currency, quoteUnit, marketState, delaySeconds, spread, freshness, reasons, sourceHash }`.

API: `GET /live/quotes` (latest per instrument), `GET /live/quotes/:instrumentId` (tape), `POST /live/watchlist` (add/remove symbols, resolved through Chapter 2 identity).

React: a dense watchlist board (WEB-TBL-02) with freshness badges, spread and change versus previous close, updated from the event stream.

## Tasks and commit checkpoints

1. **Adapt Yahoo quotes into observations.** Zod-validated transport, unit scaling, null reasons.

   Commit: `chapter-19 task-1: adapt yahoo quotes into observations to preserve units and provider time`.

2. **Classify quote freshness and book state.** Use the verified package functions and the runtime policy.

   Commit: `chapter-19 task-2: classify quote freshness and book state to separate live from stale prices`.

3. **Record the quote tape each cycle.** Persist observations and raw archives; publish them on the stream.

   Commit: `chapter-19 task-3: record the quote tape each cycle to keep replayable price evidence`.

4. **Build the live watchlist board.**

   Commit: `chapter-19 task-4: build the live watchlist board to show freshness beside every price`.

## Acceptance and adversarial cases

- [ ] A GBp quote of 2,510 is recorded as 25.10 GBP with the scale evidence.
- [ ] A quote 20 minutes old with a 15-minute exchange delay under a 5m cadence is `delayed`, not `stale`; 40 minutes old is `stale`.
- [ ] `marketState: CLOSED` yields `closed_market` regardless of age.
- [ ] bid 101 / ask 100 is recorded as crossed; bid = ask is locked.
- [ ] A symbol missing from the batch response is `unavailable` with a reason; the other symbols still record.
- [ ] Schema drift in one quote does not discard the cycle.

## Validation execution plan

Adapter tests with fake transports and captured-shape fixtures, freshness boundary tests, API tests for tape and stream, a demo-mode browser journey with a scripted quote provider. The opt-in `yahoo:quote-smoke` script records a real observation separately.

## Video walkthrough

Open with two prices for the same stock that disagree; reveal the delay and market state that explain it. Break it with a crossed book and a missing symbol.

## Exit and next boundary

Validated, freshness-classified quotes per cycle. Chapter 20 extends history to intraday and incremental bars.

## Evidence to fill during implementation

- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations:
