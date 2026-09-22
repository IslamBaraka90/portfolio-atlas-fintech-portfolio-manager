# Progress ledger

## Current checkpoint

Chapter 0: complete and published. Chapter 1: implemented and locally verified; branch publication follows the final checkpoint.
Next chapter, when requested: [Chapter 2 — Instrument identity](../PRPs/02-instrument-identity.md).
Chapters 2–17 remain planned. D14 readiness has not been announced.

The user will request each chapter separately and announce D14 package availability during the course.

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

fintech-algorithms: 0.13.1. yahoo-finance2: 4.0.2.
D14: waiting for the maintainer's announcement; follow [ADR 0003](decisions/0003-d14-release-gate.md).

The Yahoo adapter is specified and its dependency installed. Instrument discovery begins in Chapter 2; candle ingestion and validation begin in Chapter 3.

## Evidence rules for future chapters

Replace states with observed results after each task. Record the commit, commands, outcomes and limitations. A directory or installed dependency does not count as a functioning feature. Distinguish synthetic demonstrations, live observations, package parity and independent expected results.

## Next user prompt

```text
Start Chapter 2 of Portfolio Atlas using PRPs/02-instrument-identity.md.
Implement instrument discovery and eligibility with the pinned Yahoo Finance v4 adapter.
Keep the teaching style and chronological task commits. Stop at the chapter handoff.
```

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
