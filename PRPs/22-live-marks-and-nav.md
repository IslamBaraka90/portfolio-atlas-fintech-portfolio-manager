# PRP 22 — Live marks and an intraday NAV

Status: implemented and verified; see docs/chapters/22-learning-guide.md and docs/progress.md. Part V. Chapter: 22. Editorial duration estimate: 15 minutes.

## Learner question and result

**What is the portfolio worth right now, and which price did we use for each holding?**

Choose a mark for every holding from live quotes under a declared policy, value the book each cycle, and keep a NAV series whose every point links back to its quotes and FX.

## Prerequisites

Chapter 5 book, Chapter 6 valuation (`selectMark`, `valueBook`, snapshots), Chapters 19–21 quotes, bars and FX.

## Sources and conventions

Mark policy `chapter-22.live-mark.v1`:

1. During `REGULAR` with fresh last trade: last price.
2. Fresh bid and ask, not crossed: midpoint, labeled `mid`.
3. Market closed: official previous close or latest final daily close, labeled `close`.
4. Otherwise unavailable, with reasons. No fill-forward beyond the policy age.

NAV = Σ(quantity × mark × quote scale × FX) + economic cash, in base currency, using the Chapter 6 decimal rules.

## Scope

A live valuation snapshot per cycle for each active portfolio (deduplicated when nothing changed), a NAV series view, and an explicit incomplete status when any mark is unavailable. The Chapter 6 synthetic-only guard remains for authored lessons; live marks enter through the live policy with their own evidence type.

## Contracts

`MarkEvidence` gains optional `basis: dataset | override | last | mid | close` and `quoteId`; `ValuationSnapshot.policyVersion` accepts `chapter-22.live-mark.v1`. Live valuations are ordinary valuation snapshots. `NavPoint { portfolioId, valuationId, cycleId, asOf, checkpoint, baseCurrency, nav, holdings, cash, status, coverage, fingerprint }`. API: `GET /portfolios/:id/live-nav`, `POST /portfolios/:id/live-valuations`.

## Tasks and commits

1. `chapter-22 task-1: freeze the live mark policy to make every price choice explainable`.
2. `chapter-22 task-2: value the book from live marks each cycle to produce an evidenced nav`.
3. `chapter-22 task-3: keep a deduplicated nav series to track value without duplicate snapshots`.
4. `chapter-22 task-4: build the live portfolio dashboard to show nav holdings and mark evidence`.

## Backend and React outcomes

`LiveValuationService` registered as the `valuation` task after FX (tasks 2 and 3 landed in one commit because valuation and the deduplicated series share one service); a live portfolio dashboard with account summary (WEB-FIN-01), holdings grid, NAV line chart and per-holding mark evidence drawer.

## Acceptance cases

- [x] 10 shares with last 101.25 and 9,000 cash give NAV 10,012.50 (mark 101.25000000; the API test checks 9,000 + 10 × the observed last).
- [x] A crossed book falls back to last or close, never to a crossed midpoint.
- [x] A stale quote with no allowed fallback makes valuation incomplete and names the holding.
- [x] Two cycles with identical inputs create one NAV point.
- [x] Foreign holdings convert through Chapter 21 FX observations passed to the unchanged `valueBook`; a holding whose quote currency differs from its book currency is unavailable rather than converted twice.

## Validation execution

Independent arithmetic fixtures, policy boundary tests, API tests, and a demo-mode browser journey with a scripted quote provider.

## Video

Watch NAV tick during a session, open one holding and trace its number to the quote tape.

## Handoff

A live, evidenced NAV series. Chapter 23 monitors risk on it.
