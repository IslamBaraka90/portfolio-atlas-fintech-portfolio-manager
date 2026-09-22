# Progress ledger

## Current checkpoint

Chapters 0–7 are implemented. Chapters 1–6 are published as stacked PRs with green checks; Chapter 7 is at its publication checkpoint. The user authorizes the full build through Chapter 17 and announced D14 in fintech-algorithms 0.13.2; the previous Chapter 9 stopping point is revoked. Preserve task commits and verification at every chapter.

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
