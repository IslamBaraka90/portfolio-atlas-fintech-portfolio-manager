# Progress ledger

## Current checkpoint

Chapters 0-17 are implemented. Chapters 1-16 are published as stacked PRs with green checks; Chapter 17 is at its publication checkpoint. The full-build objective uses fintech-algorithms 0.13.2, including released D14 construction. The complete branch is codex/chapter-17-governance-recovery. Public deployment and specialist extensions are separately scoped.

## Part V — the live desk (enhancements branch)

| Step | Deliverable                                                             | State / commit                          |
| ---- | ----------------------------------------------------------------------- | --------------------------------------- |
| D    | TFB Open Core 03.1 design system and usability pass across all 17 desks | Complete — 86de807                      |
| P    | ADR 0005 and PRPs 18–25                                                 | Complete — see chapter-18 task-0 commit |

| 18 | Live runtime, queued budget, scheduler, routes, event stream and desk | Complete — 76ab338, 2fe698e, fd09163, see chapter-18 task-4 commit |

| 19 | Live quotes: adapters, freshness policy, tape/board/watchlist, board desk | Complete — 99a7861, edddbba, e6db4bf, see chapter-19 task-4 commit |

| 20 | Live bars: interval limits, calendar finality, live policy, incremental series, history desk | Complete — 4da3abe, 8ed74d0, c7982e3, 63fede0, see chapter-20 task-5 commit |

| 21 | Live FX: needed legs, direct/inverse/cross derivation, exact conversion, FX desk | Complete — e896fff, see chapter-21 task-3 commit |

| 22 | Live marks and NAV: mark policy, live valuation snapshots, deduplicated NAV series, dashboard | Complete — d7db51e, f22f5e4, see chapter-22 task-4 commit |

| 23 | Live risk: final-bar measures, monitor on each live valuation, risk desk | Complete — 77d37ec, c43f5af, see chapter-23 task-4 commit |

## Chapter 23 evidence

Tasks 1–4 (tasks 2 and 3 in c43f5af). `alignDailyCloses` keeps final accepted daily closes, aligns them across holdings and the benchmark and counts dropped dates. `liveRisk` (`chapter-23.live-risk.v1`) computes EWMA volatility (λ 0.94, annualized), beta and tracking error against `LIVE_BENCHMARK`, and drawdown from the live NAV series, all through verified fintech-algorithms topics; weights are current-weight replays and labeled hypothetical. `LiveRiskService` assesses each new live valuation once and runs the Chapter 14 monitor on it, keeping one finding per breach. The demo benchmark defaults to ATLS and the benchmark is always tracked. Route: `GET /portfolios/:id/live-risk`. The Live risk desk shows the measures, monitor outcome and holding table.

Observed gates (2026-09-25, Node 22.22.0): 187 unit/API checks (46 API, 79 adapters, 11 contracts, 51 core), 29 Chromium journeys, strict typecheck, production build and `npm run check`.

Independent cases: identical holding and benchmark → beta 1, tracking error 0; NAV 10,000 → 10,100 → 9,595 → −5% maximum drawdown; a forming bar at 180 changes nothing; one missing date is reported as dropped; three closes are too few. In the API test the demo portfolio (about 89% cash) breaches the cash ceiling, a full 60-return window is available from the daily backfill, the same valuation is not reassessed, and a later valuation does not add findings.

Found during verification: the EWMA covariance topic requires at least two columns, so a single-holding portfolio failed; the benchmark column is now always included and portfolio variance uses the holdings block. Drawdown requires at least two returns.

## Chapter 22 evidence

Tasks 1–4 (tasks 2 and 3 in f22f5e4). `selectLiveMark` (`chapter-22.live-mark.v1`) marks last → midpoint of a normal or locked book → close when closed → unavailable, never from a crossed book, a foreign-currency quote or a stale quote, recording basis and quote id. `LiveValuationService` builds ordinary valuation snapshots with the Chapter 6 `valueBook` arithmetic, live marks and usable Chapter 21 FX observations, so Chapters 14–16 can consume them; `MarkEvidence` gained optional `basis` and `quoteId`. A NAV point is stored only when the fingerprint (checkpoint, marks, rates, NAV) changes. Routes: `GET /portfolios/:id/live-nav`, `POST /portfolios/:id/live-valuations` (analyst). The Live portfolio desk shows the account summary, NAV line and per-holding evidence.

Observed gates (2026-09-25, Node 22.22.0): 182 unit/API checks (45 API, 75 adapters, 11 contracts, 51 core), 28 Chromium journeys, strict typecheck, production build and `npm run check`.

Independent cases: mark 101.25 → `101.25000000`; a crossed book with no last trade is unavailable; a closed market uses the last price or previous close. In the API test NAV equals 9,000 + 10 × the observed last trade, a repeated cycle adds no point, the manual command returns the same valuation id, the next demo minute adds a second point, and a holding without a quote leaves NAV null and incomplete.

## Chapter 21 evidence

Tasks 1–3 (tasks 1 and 2 in one commit, e896fff). `requiredPairs` and `requiredLegs` request one `XXXUSD=X` leg per non-USD currency needed by quoted currencies and mandate base currencies. `deriveRates` builds direct, inverse and USD-cross rates at 10 significant digits, timed at the older leg and as fresh as the least fresh leg, each wrapping a standard Chapter 4 `FxObservation`. Missing legs make a pair unavailable, never 1:1. `convertWithBoard` rounds half-even to cents and refuses stale or missing rates. `LiveFxService` runs as the `fx` task, stores legs on the quote tape and publishes `fx` events. Routes: `GET /live/fx`, `GET /live/fx/convert`. Demo mode uses authored synthetic legs.

Independent cases: 100 EUR at 1.08 → 108.00 USD; 108 USD → 100.00 EUR; GBP→EUR = 1.27 / 1.08 = 1.175925926, and 250 GBP → 293.98 EUR; 10.005 USD → 10.00 (half-even). A SAR pair without a leg is unavailable.

Observed gates (2026-09-25, Node 22.22.0): 177 unit/API checks (43 API, 75 adapters, 11 contracts, 48 core), 27 Chromium journeys, strict typecheck, production build and `npm run check`.

Found during verification: `deriveRates` used `find` to detect a missing leg, which returns the missing `undefined` itself, so the check never fired; it now uses `some`. A cycle whose every running task failed was reported `partial` because a skipped task counted as success; skipped tasks no longer count. Opt-in live smoke with `LIVE_WATCHLIST=SPY,VOD.L` before the open: VOD.L delayed, SPY closed, GBP→USD derived from live `GBPUSD=X`, 553 bars appended across two series, provider healthy.

## Chapter 20 evidence

Tasks 1–5. Scope decision: Chapter 3 datasets stay unchanged; live history is a separate revisioned series (one document per bar plus a head) using the bar row contract. `checkIntervalWindow` refuses 1m windows older than 30 days or longer than 7 days before any request. `barFinality` derives finality from the exchange calendar (intraday end + 60 s, cut at the close; daily close + 15 min). `FintechLiveBarQuality` (`chapter-20.live-bars.v1`) reuses the OHLC validator with an inferred tick, quarantines invalid, duplicate, backwards and future rows, and flags causal Hampel outliers as warnings. `LiveHistoryService` appends, revises and finalizes bars, never rewrites a final bar, and writes nothing when nothing changed. Storage gained an indexed id-prefix read. Routes: `GET /live/series`, `GET /live/series/:symbol/:interval/bars`. The Live history desk draws final candles solid and the forming candle outlined.

Independent cases: the 14:30 New York 5m bar is forming at 14:35:30 and final at 14:36; the 15:30 hourly bar ends at 16:00; London closes at 15:30Z in September and 16:30Z in November. In the API test the 11:05 bar is forming at 11:07:30, becomes revision 2 and final at 11:13:30, one bar is appended, and the earlier final bar stays at revision 1; a repeated refresh at the same instant writes no revision.

Observed gates (2026-09-25, Node 22.22.0): 173 unit/API checks (42 API, 75 adapters, 11 contracts, 45 core), 26 Chromium journeys, strict typecheck, production build and `npm run check`.

Found during verification: the demo daily backfill originally classified every minute through `Intl` and took minutes; the provider now walks sessions with resolved open/close instants (API test ~5 s). A window starting inside a bucket produced a partial bar that disagreed with the stored final bar; buckets are now always built whole, as Yahoo returns them. A corrupted build artifact from an interrupted session was cleared and rebuilt. CI on the pushed Chapter 19 checkpoint failed 18 journeys on Linux fonts because the new top-bar chip could not shrink below 390 px; the top bar now wraps and hides the cadence text on phones (CI run 36074473535 green).

## Chapter 19 evidence

Tasks 1–4. `YahooQuoteProvider` batches one `quote()` call per cycle and validates each row, so drift in one symbol becomes an explicit unavailable observation. `classifyQuote` applies `chapter-19.quote-freshness.v1` (unavailable → clock error → closed market → stale → delayed → live) with the exchange delay extending the age budget. Book state and spread come from the fintech-algorithms crossed/locked detector and quoted spread. `QuoteService` stores every observation, archives the raw response by SHA-256, appends a revisioned board, publishes `quotes` events and keeps a revisioned watchlist. Routes: `GET /live/quotes`, `GET /live/quotes/:symbol`, `GET/POST /live/watchlist`.

Independent cases: GBp 2,510 → 25.10 GBP. Under `5m` a 15-minute-delayed quote is delayed at 20 and 25 minutes and stale at 40. Bid 101/ask 100 is crossed with spread withheld; bid = ask is locked with spread 0. A 30-minute one-sided quote is stale by the labeled application rule. A provider time 5 minutes ahead is unavailable.

Observed gates (2026-09-24, Node 22.22.0): 162 unit/API checks (40 API, 69 adapters, 11 contracts, 42 core), 25 Chromium journeys, strict typecheck, production build and `npm run check`. Opt-in live smoke with `LIVE_WATCHLIST=SPY,AAPL,VOD.L,NOPE-XYZ` after the close recorded 4 observations: 3 closed market, 1 unavailable. A 390 px journey found a page overflow caused by a visually hidden label inside a scrolled table; table wrappers now contain it.

## Chapter 18 evidence

Tasks 1–4. `parseLiveRuntime` freezes mode, cadence, cache lifetime, freshness, watchlist, benchmark and request cap; invalid values stop startup naming the variable. `sessionState` classifies New York and London regular hours through `Intl` (DST-safe) and records holidays as not modeled. `RequestBudget` gains an optional bounded queue, 250 ms spacing and a rolling per-minute cap; interactive calls still fail fast. `LiveRefreshService` records append-only cycles, logs skipped ticks, captures each completed session once, backs off 1×, 2×, 4× the period and resets after one success. Routes: `GET /live/status`, `GET /live/cycles`, `GET /live/cycles/:id`, `POST /live/cycles` (operator, idempotent) and `GET /live/stream` (server-sent events). The React Live runtime desk and top-bar chip read the stream.

Independent cases: `1m` → 60 s period, 50 s cache, 180 s freshness. 2026-03-09 14:00Z is open (10:00 EDT); 2026-03-06 14:00Z is before the open. At 16:10 EDT with 15-minute grace the latest completed session is the prior day; at 16:16 it is today. Starting mid-session in EOD mode captures the previous session once, then waits for the close.

Observed gates (2026-09-24, Node 22.22.0): 150 unit/API checks (38 API, 59 adapters, 11 contracts, 42 core), 24 Chromium journeys including the live runtime journey, strict typecheck, production build and `npm run check`. Opt-in `MARKET_DATA_MODE=live npm run live:smoke` observed a completed cycle against Yahoo: session `after_close`, covers 2026-09-24, provider probe answered for SPY, health `healthy`. Limitations: holidays, half days and auctions are unmodeled; one primary venue schedules the loop; the probe proves reachability only.

Design-system evidence (2026-09-24, Node 22.22.0): `npm run check` (including generated-token verification), strict typecheck, 131 unit/API checks, production build and 23 Chromium journeys passed. An audit of all 17 routes at 1440, 1024 and 390 px in light and dark themes reported no page overflow, no visible text below 14 px, no control below 44 px and no unlabeled field. Populated journey end states were inspected at desktop and 390 px, in dark mode and in print emulation. Assistive-technology testing was not performed.

## Foundation tasks

| Task | Deliverable                                                                                   | State / commit                         |
| ---- | --------------------------------------------------------------------------------------------- | -------------------------------------- |
| 0.1  | Independent repository, six npm workspaces, pinned dependencies and ownership                 | Complete — 1186b8e                     |
| 0.2  | Architecture, data model, API and adapter contracts, capability inventory                     | Complete — 6b55daa                     |
| 0.3  | Chapter 1–8 PRPs                                                                              | Complete — 0fcb32d                     |
| 0.4  | Chapter 9–17 PRPs                                                                             | Complete — 8c9ed0f                     |
| 0.5  | Course index, chapter 0, specialist extensions, video/evidence templates and documentation CI | Complete — see chapter-0 task-5 commit |
| 0.6  | Public GitHub publication and remote validation                                               | Complete — see chapter-0 task-6 commit |

## Observed foundation validation

Date: 2026-09-22. Runtime: Node 22.22.0; npm 10.9.4.

| Check                             | Observed result                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| npm dependency installation       | Successful; exact versions and lockfile committed                                                         |
| npm ls --workspaces --depth=0     | All six workspaces resolve                                                                                |
| npm run check                     | Prettier passed; Markdown lint passed for 61 Markdown files                                               |
| Relative Markdown link inspection | All local file targets resolve                                                                            |
| Chapter structure inspection      | 18 numbered PRPs; Chapters 1–17 contain required contracts, tasks, acceptance, video and handoff sections |
| Planning-scope inspection         | No application .ts/.tsx/.js/.mjs/.sql files tracked or proposed                                           |
| Dependency capability inspection  | Installed fintech-algorithms 0.13.1: 697 topics; D14 absent; payload hash recorded                        |
| Package lookup                    | D01-F02-A01 resolves to validateBars; contract-tier status recorded                                       |
| Required agent guides             | Both pinned dependencies contain their bundled SKILL.md                                                   |
| git diff --check                  | Passed                                                                                                    |

At the Chapter 0 checkpoint, only documentation/configuration checks existed. Chapter 1 runtime evidence is recorded below; live Yahoo checks remain unimplemented.

## Publication evidence

Public repository: [Portfolio Atlas](https://github.com/IslamBaraka90/portfolio-atlas-fintech-portfolio-manager).
Default branch: main. Repository name, description and 14 discovery topics are configured.

The first public documentation workflow passed on a clean GitHub runner for commit 6c9c59a: [successful run](https://github.com/IslamBaraka90/portfolio-atlas-fintech-portfolio-manager/actions/runs/35658569253). It installed the committed dependency graph and ran formatting/Markdown checks. The current workflow badge in the README tracks later commits.

The initial remote main matched the local foundation commit. The final publication-evidence commit is pushed separately; its remote and workflow status are checked at handoff. That publication evidence describes the completed Chapter 0 baseline.

## Package checkpoint

fintech-algorithms: 0.13.2. yahoo-finance2: 4.0.2.
D14: 20 published contract-tier methods; follow [ADR 0003](decisions/0003-d14-release-gate.md).

The Yahoo adapter is specified and its dependency installed. Instrument discovery begins in Chapter 2; candle ingestion and validation begin in Chapter 3.

## Evidence rules for future chapters

Replace states with observed results after each task. Record the commit, commands, outcomes and limitations. A directory or installed dependency does not count as a functioning feature. Distinguish synthetic demonstrations, live observations, package parity and independent expected results.

## Current execution request

Continue the full implementation through Chapter 17. No further chapter-start prompt is required.

## Chapter 1 task evidence

- Task 1: schemas, synthetic fixtures and the definition contract are implemented. `npx tsc -b packages/contracts packages/testing` passed; all four contract tests passed. Input precision, null sectors and draft-policy conflicts are explicit.

- Task 2: the API and React development entry points are wired. The production build, strict type check and an injected API health request passed. A Vite build guard prevents backend and market-provider modules entering the browser bundle.

- Task 3: pure basis-point rules, versioned use cases and isolated memory storage are implemented. All 14 contract/domain/service tests and strict type checks passed. Coverage includes exact boundaries, duplicate commands, stale revisions, immutable history, missing sectors and empty state after restart.

- Task 4: mandate, portfolio, evaluation, lesson and audit endpoints are connected. All 18 tests passed, including the HTTP journey, 400/409 distinctions, session isolation and request-linked audit metadata. Strict type checks passed.

- Task 5: React now creates portfolios, edits mandate revisions, evaluates five synthetic scenarios and displays server findings/provenance. The first four connected Chromium checks passed, including failed-request recovery, keyboard focus and a 390px mobile layout. Build and browser dependency guard passed.

## Chapter 1 checkpoint map

| Task                   | Commit                      | Result                                                       |
| ---------------------- | --------------------------- | ------------------------------------------------------------ |
| Contracts              | 38fed56                     | Four schema checks; explicit precision and fixture contract  |
| Runtime                | fa35908                     | API health, React entry and dependency build graph           |
| Domain and application | edbfa14                     | Fourteen cumulative contract/rule/service checks             |
| HTTP                   | 0e39d6f                     | Eighteen cumulative checks, including real Fastify injection |
| React                  | 5e9e5b5                     | Connected editor and explained server outcomes               |
| Verification           | See chapter-1 task-6 commit | Connected browser suite, teaching guides and CI              |

The chapter uses authored teaching policies rather than an invented npm suitability/mandate API. No provider observations or live financial results are claimed. Zod 4.6.5 validates the boundary; Node 22.22.0 executes the tests.

### Local evidence

- Contract/domain/application/HTTP tests: 18 passing before the final browser additions.
- Browser: all five example outcomes, three saved policy revisions, saved-portfolio reload, focused network error and retry, loading state, keyboard skip link and changed-session notification.
- Visual review: actual 1512px desktop and 390px mobile screenshots inspected; no page-width overflow at 390px.
- Production build: passed; Vite module-graph guard excludes backend and market-provider modules.
- Definition and learner walkthrough: [Chapter 1 guide](chapters/01-learning-guide.md), [HTTP reference](chapters/01-http-reference.md), [recording notes](video/chapter-01-recording-notes.md).

### Explicit limits

Memory storage resets with the API process and is shared by local browsers. The reset invariant is tested with separate application instances; the browser's changed-session message is tested with a prior session ID. There is no durable database, login, live Yahoo discovery, candle processing, actual holdings ledger or trading. ETF sector labels are supplied classifications, not constituent look-through. Historical policy reconstruction and portfolio optimization are outside Chapter 1. D14 remains gated.

### Final local validation

A fresh npm ci --ignore-scripts completed with zero reported vulnerabilities. All 18 contract/domain/application/API tests passed. All six connected Chromium journeys passed, including a committed response lost on the wire (retry creates no duplicate portfolio) and a concurrent policy edit followed by conflict recovery. Formatting, Markdown lint (65 files), strict type checks, production build, browser dependency guard and local Markdown link checks passed. Generated screenshots remain ignored.

## Chapter 2 evidence

Task 1 defines instrument/listing identity, subunits, explicit unknowns, alias clocks and synthetic fixtures. Contracts validate whole-second package inputs without time truncation.

Task 2 implements the Yahoo v4 class adapter and deterministic synthetic provider. Seven adapter/service tests pass. Subunit conversion, null tick/MIC evidence, schema failures, throttling, cache lineage and timeout/concurrency retention are covered. The core port contains no Yahoo types.

Task 3 resolves effective-dated aliases through the verified D02 export and evaluates mandate/instrument revisions. All 28 unit/API tests and type checks pass. Independent cases cover ticker continuity, half-open intervals, future evidence, overlapping aliases, disallowed types, similar-name securities and Yahoo symbol mismatch.

Task 4 connects search, explicit resolution, saved instruments, eligibility and alias queries to the React explorer. All 30 unit/API tests and eight browser journeys pass. Yahoo-disabled mode remains visibly unavailable; no synthetic fallback occurs. Desktop and mobile screenshots were produced.

Task 5 adds focused concurrent-command verification, immutable instrument history, browser regression and a real opt-in Yahoo smoke. Live AAPL search/quote succeeded at 2026-09-22T10:52:40–42Z; legal tick remains null and permanent identity remains unverified. See the Chapter 2 guide for exact observations.

Final Chapter 2 gates: 32 unit/API checks and eight browser journeys passed; strict types, formatting, Markdown lint, production build and browser dependency guard passed. Desktop and 390px mobile evidence inspected.

## Chapter 3 evidence

Task 1 (1e03352) froze nullable rows, UTC windows, adjustment basis and evidenced finality. Task 2 (05e64bd) added chart retrieval, shared request/cache policy and SHA-256 evidence archives. Task 3 (43f24c1) combined contract-tier OHLC/gap exports with independent dataset rules. Task 4 (b8236fe) connected API, immutable revisions and the React candle desk.

Synthetic independent example: 12 rows, accepted indexes [0, 3, 5, 11], eight quarantined, one known missing session with unknown cause. Clean fixture: all 12 accepted. Type checks, 39 unit/API cases and the connected candle browser journey passed before final evidence additions. Desktop and 390px mobile screenshots inspected; no page-width overflow.

Task 5 adds exact-byte filesystem evidence checks, archive-failure retry and live chart observation. See the [learning guide](chapters/03-learning-guide.md). Chapter 4 follows under the continuous authorization.

Final Chapter 3 gates: all 41 unit/API checks and nine connected Chromium journeys passed. Formatting, Markdown lint (69 files), strict types, production build and browser dependency guard passed. Live AAPL chart returned 12 rows at 2026-09-22T11:13:58.412Z; all retained and explicitly quarantined for unknown tick, identity and finality evidence.

## Chapter 4 evidence

Tasks 1–4: ae8bd4f, e1530f2, 6a78821, a413ff5. Frozen definitions and primary references, immutable raw-evidence reads, Yahoo event candidates, authored action revisions, verified split/dividend imports, explicit FX direction/freshness, API replay and a connected React comparison desk.

Independent examples passed: 100/2 = 50; gross dividend factor 50/52; USD 100 × 0.90 = EUR 90; reciprocal returns USD 100. Revision 2 changes the dividend to 2.5; revision 3 cancellation removes it. Raw source snapshot is unchanged. Focused browser journey passed, including price toggles, revision cutoffs and parent-dataset navigation.

Task 5 adds archive tamper detection, independent basis-drift diagnosis and final recording evidence. Current-price research is explicitly distinguished from historical backtest availability. Chapter 5 is authorized next.

Final Chapter 4 gates: 50 unit/API checks and all ten connected Chromium journeys passed. Formatting, Markdown lint (71 files), strict types, production build and browser dependency guard passed. Desktop and 390px mobile captures were inspected. The basis-drift example independently flags log(1.01) × 10,000 ≈ 99.503309 bps while accepting the exact split factor.

## Chapter 5 work in progress

Task 1 (0fab906) freezes decimal strings, half-even currency rounding, FIFO book lots, fee expense, immediate teaching settlement, reservations and the latest-event correction boundary.

Task 2 introduces Node 22.22 SQLite migration 1 and decimal.js 10.6.0. Commands atomically commit state and replay records; provider preparation occurs outside the transaction. All 54 unit/API checks passed, including full evidence restart and injected commit failure rollback. Browser regression follows the storage metadata update. No book posting capability is claimed until the next tasks.

Task 2 browser regression: all ten connected journeys passed with SQLite-backed application composition. Persistent and ephemeral storage are labeled accurately.

## 0.13.2 release checkpoint

The release is pinned exactly. The installed payload has 717 topics, including 20 D14 contract-tier methods. Strict type checks and all 60 existing unit/API checks passed after upgrade, including independent symmetric and asymmetric two-asset minima and inverse-volatility weights. npm reported zero known vulnerabilities during installation. The full Chapters 1–17 authorization supersedes the former D14 stop.

## Chapter 5 completion checks

Task 3 (54ba297) adds event replay, FIFO costs, reservations, journal balancing and corrections. Task 4 (0ac06bc) connects the API and React book. The connected Chromium walkthrough passed with duplicate-command replay, an 8-share correction, immutable original journal and rejected unaffordable purchase. Desktop and mobile captures were inspected; mobile has no page overflow.

Task 5 checks partial-journal rollback and durable restart, repeated latest-active corrections, and tampering with both an original and its reversal. Final gate results follow. Chapter 6 continues under full-build authorization.

Final Chapter 5 gates: strict typecheck passed; all 62 unit/API checks passed; production build and browser dependency guard passed; Prettier and Markdown lint (74 files) passed; all 11 connected Chromium journeys passed. Chapter 4 GitHub checks are green. SQLite failure/retry/restart evidence and reversed-history tamper checks passed.

## Chapter 6 checkpoints

Task 1 (92d48db) freezes share basis, decimal NAV, freshness, FX and benchmark conventions. Task 2 (e78f52f) rebuilds selected journal checkpoints and values accepted marks with incomplete coverage preserved. Task 3 (03d39ca) uses looked-up D03/D00 methods for equal-initial-weight buy-and-hold price/gross-total-return histories. Task 4 (73e7605) connects HTTP, persistent snapshots and the React desk.

Independent expected values: NAV 10,095; after external deposit 10,595; EUR 90 at 0.9 EUR/USD adds USD 100. The two-asset buy-and-hold example returns 10%, versus 12.5% for daily resetting. A 10 dividend on a 100→90→99 path gives +10% gross total return versus −1% price return.

The focused API test passed through dataset revisions, missing/stale price and FX, convention mismatch, restart and command replay. The connected Chromium journey passed, including incomplete NAV and restored coverage. Desktop and 390px captures were inspected. Chapter 5 remote checks are green. Final Chapter 6 gates follow.

Final Chapter 6 gates: all 70 unit/API checks and 12 connected Chromium journeys passed. Strict typecheck, production build, browser dependency guard, formatting and Markdown lint (76 files) passed. No live fundamental data or portfolio performance results are claimed by this chapter.

## Chapter 7 evidence

Tasks 1–4: 6d96aec, f5a5799, 71d0200, 81dde57. Exact statement periods and current Yahoo availability, archived original financial JSON, three selected descriptive methods, immutable research references and connected React evidence panel.

Independent examples passed: three-slot SMA 102; net income / revenue 15%, +5 percentage points; late correction 12.5% after release. Missing statements, zero revenue, mixed currencies/periods, late revisions, observed-now historical rejection, null warm-up and missing-universe coverage remain explicit.

Live AAPL fundamentals smoke succeeded at 2026-09-22T12:47:34.602Z with three 12M USD records; source hash and exact limitations are in the learning guide. The installed optimized SMA rejects nullable inputs despite its catalog description; contiguous numeric segments preserve null slots and restart warm-up.

Final Chapter 7 gates: 80 unit/API checks and all 13 connected Chromium journeys passed. Strict typecheck, production build, browser dependency guard, formatting and Markdown lint (78 files) passed. Desktop and 390px mobile screenshots were inspected after presentation fixes. Chapter 6 remote checks are green. Chapter 8 continues under the full-build authorization.

## Chapter 8 evidence

Tasks 1–4: 2d5ba68, 2b50d22, a90fe0b, a8978a5. Ordered aligned daily returns, explicit simple/log and price/gross-total-return conventions, sample/EWMA/scaled-identity shrinkage, bounded matrix diagnostics, immutable API snapshots and React method comparison.

Independent examples passed: covariance [[0.01, -0.005], [-0.005, 0.01]], correlation -0.5, annual diagonal 2.52 at 252 sessions; EWMA weight mass 0.75 and seed mass 0.25. Identical clean AURA/HARB paths produce rank 1; shrinkage produces rank 2 for that sample. Constant paths retain undefined correlation. Missing sessions, wrong revisions, mixed currencies and future observations fail before estimation.

The initial whole-course browser run exposed duplicate scenario fields for unselected histories. Scenario fields now appear only for selected inputs. The complete rerun passed all 14 Chromium journeys. Final gates also passed: 89 unit/API checks, strict types, production build, browser dependency guard, formatting and Markdown lint (80 files). Desktop and 390px captures were inspected. Chapter 7 remote checks are green. Continue to released D14 construction under the full-build authorization.

## Chapter 9 evidence

Tasks 1–4: 05961ee, 29e5fbb, 25d9e4b, 7b6d36b. Verified installed D14 signatures, frozen target contracts, four construction methods, independent risk/cost/mandate audits, immutable API snapshots and a connected React comparison desk. D14 methods are contract tier; independent application examples are separately tested.

Examples: equal weights with 20% cash produce 40/40/20; inverse volatility 0.1/0.2 produces 2/3 and 1/3; a two-asset minimum variance example gives 8/11 in the first asset. A doubled volatility stress quadruples variance. Failed convergence, impossible capacity, unknown sectors, cost rejection and revision mismatch retain explicit outcomes. Proposal creation leaves the accounting checkpoint unchanged.

Final gates: 94 unit/API checks, 15 Chromium journeys, strict types, production build, browser dependency guard, formatting and Markdown lint (83 files) passed. Desktop and 390px mobile captures were inspected. Chapter 8 remote checks are green. Continue to causal strategy validation.

## Chapter 10 evidence

Tasks 1–4: 8f0c8f7, 8008857, e12e131, 69c135b. Authored historical bars and membership, causal folds, isolated existing-ledger replay, package drawdown, saved API evidence and React timeline/cost comparison.

Independent expected values: 74 shares at 107, fee 7.92, final NAV 10,362.08 versus 10,370.00 without fees. Authored delisting recovery produces a FIFO loss of 7,548 and zero-fee NAV 2,452. Future holdout mutation preserves earlier results and fitted scores. Late filings and missing sessions block performance.

Final gates: 98 unit/API tests and 16 browser journeys passed, along with strict types, production build, browser dependency guard, formatting and Markdown lint (85 files). An untracked PR-body Markdown file under .git initially tripped documentation lint; renaming this tool-owned temporary file to .txt resolved it without changing project checks. Desktop and mobile screenshots inspected. Chapter 9 remote checks are green. Continue to current-target rebalancing.

## Chapter 11 evidence

Tasks 1–4: b57ba97, 6fc17e3, 63782e7, b0fb2ec. Whole-lot cash-funded sizing, triggers, minimum trades, FIFO previews, D14 illustrative fixed-sale comparison, post-fee constraints and revision-safe approval.

Independent case: 39 shares each at 100, purchases 7,800, fees 7.80, available cash 2,192.20 and NAV 9,992.20. A balanced book now correctly avoids fee-buffer-induced turnover. Contributions, reserved funds, off-tick/stale marks, FIFO final cents, same-time lot order, expired proposals and changed book/valuation/instrument evidence are covered. D14 negative score −40 is not cash.

Browser verification found successful command keys were being reused for later deliberate submissions. Keys now remain only until confirmed success; the lost-response retry regression still passes. Final gates: 105 unit/API tests, 17 Chromium journeys, strict types, production build, browser dependency guard, formatting and Markdown lint (87 files) passed. Desktop/mobile captures inspected. Chapter 10 remote checks are green. Continue to paper execution.

## Chapter 12 evidence

Tasks 1–4: f83558d, 52849b5, 2791007, 4002570. Exact approved-proposal consumption, single active batch per portfolio, atomic reservations, protected market/limit opening model, partial fills, cancel acknowledgments, stable event IDs and a connected blotter. D12 tick/residual methods use verified installed fields and integer atom checks.

Independent replay: 4 then 6 fills at 390 produce 10 shares, fees 3.90 and cash 6,096.10. Duplicate events and restart never double-post. Injected journal failure rolls back release/fill/re-reserve. Current cash must fund acceptance; unexecuted sales cannot. Revoked restrictions and stale approvals reject submission. The browser commits a fill then loses its response and safely retries; it also demonstrates protected-market rejection and cancellation release.

Final gates: 111 unit/API tests and 18 Chromium journeys passed. Types, production build, browser dependency guard, formatting and Markdown lint (89 files) passed. Desktop/mobile screenshots inspected. Chapter 11 remote checks are green. Continue to explicitly configured deferred settlement and reconciliation.

## Chapter 13 evidence

Tasks 1-4: 15b92be, 4da67b3, 9f27d34, acf2d70, 8a61971. Authored calendars, deferred payable/receivable accounting, partial and failed delivery, active-batch checkpoint updates, independent immutable statements, conservative matching and approved reverse/repost.

Independent examples: buy 10 at 390 plus 3.90 fee; settled cash stays 10,000 while economic cash becomes 6,096.10. Nine delivered shares leave settled cash 6,486.49 and 390.39 payable. Final delivery leaves 6,096.10 cash and 10 custody shares. NAV is unchanged by settlement. A 100 versus 90 deposit break closes only in a new run after reversal/replacement; the original break and statement revisions remain unchanged. Ambiguous or reused candidates never clear a fill.

Final gates: 117 unit/API tests, 19 connected Chromium journeys, strict types, production build, browser dependency guard, formatting and Markdown lint (91 files) passed. Browser selectors were corrected to the actual accessible control names; desktop and 390px screenshots inspected. The build reports the application bundle exceeding its 500 kB advisory threshold; lazy chapter loading is a Chapter 17 delivery task. D43/D30 and inferred corporate-action entitlements remain explicitly unsupported; evidenced receipts are reconciled. Chapter 12 remote checks are green. Continue to risk monitoring.

## Chapter 14 evidence

Tasks 1-4: edc9348, ef2f134, 2a2bb7f, a2f10ff. Frozen risk definitions, economic position/sector/currency exposure, current/proposed shocks, exact historical loss conventions, D00 adapter checks, immutable monitor snapshots and deduplicated lifecycle actions.

Independent results: -10% of a 1,000 position is -100; a 40/40/20 target on 10,000 NAV loses 800 under that parallel shock. A 100 to 80 to 80 illustration has 20% maximum drawdown and 19% two-point interpolated 95% loss quantile. Acknowledgment preserves a breach; changed book/stale data cannot resolve it. A fresh 40/40/20 valuation passes the exact 40% position boundary and permits explicit cash-finding resolution.

Final gates: 119 unit/API tests, 20 Chromium journeys, strict types, production build, browser dependency guard, formatting and Markdown lint (93 files) passed. The full browser run caught a hard-coded instrument revision in the new test; using the resolved fixture revision fixed cross-chapter execution, and the full rerun passed. Desktop/mobile screenshots inspected. A Windows encoding failure truncated this ledger during task 4b; task 4c restores the previously committed evidence and adds this section using explicit UTF-8. Chapter 13 remote checks are green. Current-weight history is explicitly hypothetical; liquidity remains unavailable without sufficient volume and participation policy. Continue to cash-flow-aware performance.

## Chapter 15 evidence

Tasks 1-4: 896041b, 7c05a1e, 0197d39, 62161a4. Frozen valuation/flow contracts, geometric TWR, labeled Dietz approximation, recorded-fee comparison, bounded IRR diagnostics, one-period Brinson-Fachler effects, linked-source checks and connected React curves/waterfall.

Independent cases: 10,095 plus a 500 deposit becomes 10,595 with zero investment return. A 105.95 fee against 10,595 reduces net return by 1% while the named fee-add-back comparison is zero. Linked +10% and -10% returns yield -1%. A midpoint 100 deposit into 100, ending at 220, gives Dietz 20/150. Nonconventional -100/+230/-132 flows have period roots 21% and 44%; no arbitrary headline is selected. Attribution 0.5 + 0.5 + 0.3 percentage points reconciles to 1.3 active points with zero residual; a false account linkage remains incompatible.

Final gates: 123 unit/API tests, 21 Chromium journeys, strict types, production build, browser dependency guard, formatting and Markdown lint (95 files) passed. Desktop/mobile screenshots inspected. Actual HTTP latency is handled only by the documented immediate single-flow bridge with unchanged holdings/FX and exact NAV difference. D16 exports are absent in installed 0.13.2; these application calculations use primary-source conventions and independent fixtures. Foreign-flow FX, correction restatement and multi-period/factor attribution remain explicit boundaries. Chapter 14 remote checks are green. Continue to frozen management reports.

## Chapter 16 evidence

Tasks 1-3: f1297bf, 19600b9, 5cb7d21. Exact snapshot selection, consistent valuation/monitor/performance cutoffs, deterministic evidence-linked insights, missing-section coverage, revision approval and supersession, JSON/CSV and printable HTML.

Independent example: holdings 1,000 plus economic cash 9,000 equal NAV 10,000. A later mark creates NAV 10,100 in a superseding report; approved prior JSON and CSV stay byte-for-byte unchanged. Missing-section approval requires acknowledgment. Formula-like user text remains inert in CSV.

Final gates: 125 unit/API checks, 22 Chromium journeys, strict types, production build, browser dependency guard, formatting and Markdown lint (97 files) passed. Desktop, 390px mobile and print-emulation captures inspected. Chapter 15 remote checks are green. Regulatory formats and PDF generation remain outside the teaching scope. Continue to governance and recovery.

## Chapter 17 evidence

Tasks 1-4: 878e4d3, cf8ccd5, 999cb79, 27736c3. Frozen threat/access contract, external effective-dated grants, actor/scope command keys, session/CSRF enforcement, transaction-bound creator and audit records, prior/new override evidence, protected backups, isolated restore/replay and a connected governance desk.

Direct API checks reject absent credentials, reader mutations, an unrelated workspace, self-approval, expired/revoked grants, invalid CSRF and configured-scope downgrade on restart. Server identity replaces spoofed reviewer text. A configured approver cannot approve a draft created under unauthenticated local-owner authority; UI inbox and command commit both reject it. Replayed successful commands create one business audit event. The price-override example preserves prior 100.00000000, new 110, reason, actor and policy.

The durable restore fixture preserves ten shares, 9,000 cash, referenced raw archives and byte-identical issued report JSON. A later live 500 deposit remains outside the restored cutoff. A changed backup byte fails before database replay and produces no replacement path. Memory lessons report recovery unavailable. The governed browser journey signs in as two actors, rejects direct self-approval, issues a report and verifies an actual restored directory.

Observed local gates: 131 unit/API checks (35 API, 55 adapters, 11 contracts, 30 core), 23 Chromium journeys, strict typecheck, production build, browser dependency guard, formatting and Markdown checks. A textarea selector was corrected to its accessible textbox role; screenshot inspection caught inherited hero spacing and an overflowing audit table. Shared styles now load at the application root and the table scrolls inside the mobile viewport. Desktop and 390px captures inspected. Follow-up access checks passed after tightening legacy creator evidence. Lazy chapter imports reduce the initial JS bundle from 548.62 kB to 358.59 kB and remove the 500 kB advisory warning.

Chapter 16 remote checks are green. Final Chapter 17 publication repeats all CI gates. Local-owner mode trusts the OS user and permits solo review; configured sessions enforce one workspace scope. Policy reload/revocation requires restart. Public deployment, multi-tenant hosting, MFA/federation, remote audit attestation, automatic live-book promotion and specialist financial modules are not claimed. The [access](runbooks/access-and-incidents.md), [recovery](runbooks/backup-and-recovery.md) and [recording checkpoint](video/implemented-checkpoints.md) guides complete the course handoff.
