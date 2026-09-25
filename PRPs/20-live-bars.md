# PRP 20 — Live bars: intraday intervals and incremental history

Status: implemented and verified; see docs/chapters/20-learning-guide.md and docs/progress.md. Part V. Chapter: 20. Editorial duration estimate: 15 minutes.

## Learner question and result

**When is a live bar final, and how do we extend history without rewriting it?**

Extend the Chapter 3 dataset from daily-only to intraday intervals, refresh history incrementally each cycle, and admit Yahoo rows through a named live-provider policy instead of quarantining them all.

## Prerequisites

Chapter 3 datasets, raw archive and quality report; Chapter 18 session calendar; Chapter 19 quotes.

Catalog connections: `ohlc-consistency-validator` and `missing-bar-gap-classifier` (already used), `hampel-bad-tick-filter` (`hampelFilter`, contract tier, causal mode).

## Scope

Scope decision (recorded during implementation): Chapter 3 datasets are unchanged because Chapters 4–15 depend on their daily, synthetic-policy contract. Live history is a separate revisioned series (one document per bar plus a series head) that reuses the bar row contract.

- Intervals `1m, 5m, 15m, 1h, 1d` with Yahoo's documented intraday availability limits enforced before the request.
- Incremental refresh: fetch only the tail window, append new bars, revise the forming bar, and keep every earlier revision.
- Finality from the session calendar: an intraday bar is `final` once its interval end has passed plus a grace period; a daily bar is `final` after the session close plus grace; otherwise `incomplete`.
- Live-provider policy `chapter-20.live-bars.v1`: identity observed through Chapter 2 resolution, tick size inferred from quote `priceHint` and labeled `inferred`, finality derived as above. The synthetic policy and its stricter checks are unchanged.
- Causal Hampel screening flags suspicious closes as warnings; it never deletes rows.

## Contracts

`MarketDataset.interval` widens to the supported set; rows keep `finality` and gain `finalityEvidence`. `IncrementalRefresh { datasetId, fromRevision, toRevision, appended, revised, unchanged, window }`.

## Tasks and commits

1. `chapter-20 task-1: widen dataset intervals with provider limits to support intraday history`.
2. `chapter-20 task-2: derive bar finality from the session calendar to separate forming from final bars`.
3. `chapter-20 task-3: admit live rows through a named provider policy to use yahoo history honestly`.
4. `chapter-20 task-4: refresh history incrementally each cycle to extend datasets without rewriting them`.
5. `chapter-20 task-5: render live intraday candles to show forming and final bars`.

## Backend and React outcomes

`LiveHistoryService` registered as the `bars` refresh task; routes `GET /live/series` and `GET /live/series/:symbol/:interval/bars`; a Live history desk with symbol and interval selection, a forming-bar marker and per-bar finality evidence.

## Acceptance cases

- [x] A 1m request older than Yahoo's limit is refused before any network call with the limit named.
- [x] A 5m bar ending 14:35 New York is `incomplete` at 14:35:30 and `final` at 14:36 with a 60 s grace.
- [x] Refreshing twice with no new data produces no new revision.
- [x] A revised forming bar creates a new bar revision and preserves the earlier revision; a final bar never changes.
- [x] Live rows pass under the live policy; the Chapter 3 synthetic policy and its fixtures are untouched and still pass their journeys.
- [x] A Hampel outlier stays in the dataset with a warning.

## Validation execution

Unit tests for interval limits, finality, incremental merge and policy selection; adapter tests for intraday chart shapes; a browser journey for interval switching in demo mode.

## Video

Show a bar change while it forms, then freeze. Break it by requesting 1m data from last year.

## Handoff

Live, revisioned history. Chapter 21 adds live FX so foreign holdings can be valued.
