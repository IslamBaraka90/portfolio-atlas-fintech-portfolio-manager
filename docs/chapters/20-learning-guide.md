# Chapter 20 — when is a live bar final?

Chapter 3 taught that a candle is only as good as its evidence. Live bars add time: the latest bar is still forming, the provider only keeps intraday history for a while, and every refresh overlaps the one before. This chapter keeps live history honest without rewriting it.

## Scope decision

Chapter 3 datasets stay the immutable daily lesson artifact that Chapters 4–15 consume under the synthetic policy. Live history is a separate **series**: one symbol at one interval (`1m`, `5m`, `15m`, `1h`, `1d`), stored as one revisioned document per bar plus a revisioned series head. Every bar reuses the Chapter 3 bar contract, and live rows are admitted by a named policy rather than by relaxing the synthetic one.

## Provider limits before requests

`checkIntervalWindow` refuses impossible requests before any network call: 1-minute bars only within the last 30 days and at most 7 days per request, other intraday intervals within 60 or 730 days. Daily bars have no lookback limit. `intervalForCadence` maps `LIVE_REFRESH` to the matching bar interval, and every tracked symbol also keeps a daily series for the risk chapter.

## Finality from the calendar

Yahoo does not say whether a bar is final. `barFinality` decides from the exchange session: an intraday bar ends after its interval, cut at the session close (the last hourly New York bar runs 15:30–16:00), plus 60 s of grace; a daily bar ends at the close plus the 15-minute policy grace. The 14:30–14:35 New York bar is forming at 14:35:30 and final at 14:36. `localInstant` resolves local session times through `Intl`, so the London close is 15:30Z in summer and 16:30Z in winter.

## The live provider policy

`chapter-20.live-bars.v1` (`FintechLiveBarQuality`) states which synthetic guarantees it replaces:

- the tick is inferred from Yahoo's `priceHint` and every row carries an `INFERRED_TICK` warning;
- identity is the Chapter 2 instrument when saved, otherwise a `WATCHLIST_ONLY_IDENTITY` warning;
- finality comes from the calendar, never the vendor.

OHLC consistency, invalid or missing prices, duplicate starts, backwards order and future starts quarantine a row. Causal Hampel screening (D01-F02-A02, contract tier; radius 10, threshold 5, history 10) flags an outlier as a warning and keeps the bar for review.

## Incremental refresh

`LiveHistoryService.refresh` requests only the tail of a series, overlapping two bars so a forming bar is always re-requested:

- a new start is **appended** at revision 1;
- a forming bar that changed, or became final, gets its next revision (**revised** or **finalized**);
- a final bar never changes. If the provider later disagrees, the stored bar stays and the disagreement is counted and warned;
- a refresh with nothing new writes nothing.

Bars are read by an indexed id prefix (`symbol|interval|`). One unknown symbol is reported in the task detail without failing the cycle or triggering back-off.

## Walkthrough

Open **Live history**, select **Refresh history**, and choose a symbol and interval. Final candles are solid; the forming candle is outlined in the accent colour. The table shows each bar's revision and why it is final or still forming. In the API test, the 11:05 bar is forming at 11:07:30 and becomes revision 2, final, at 11:13:30, while the earlier final bar stays at revision 1.

## Recording sequence

Provider limit refusal → forming vs final at the grace boundary → hourly bar cut at the close → Hampel warning kept → append, finalize, no-op refresh → candle view.

Chapter 21 adds live FX so foreign listings can be valued in the portfolio's base currency.
