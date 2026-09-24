# PRP 18 — Live market-data runtime and refresh policy

Status: implemented and verified; see docs/chapters/18-learning-guide.md and docs/progress.md. Part V, the live desk. Chapter: 18. Editorial duration estimate: 15 minutes.

## Learner promise

**How fresh must my data be, and what happens when the provider cannot keep up?**

Configure the desk for demo or live data, choose a refresh cadence from end of day to one minute, and see every refresh cycle, provider failure and back-off as recorded evidence.

## Prerequisites and context

Chapters 2–3 Yahoo adapters (`YahooInstrumentProvider`, `YahooChartProvider`), `RequestBudget`, `ProviderCalls` and the governed workspace from Chapter 17. Read [ADR 0005](../docs/decisions/0005-live-market-data-runtime.md), the [architecture](../docs/architecture/README.md) and the installed Yahoo v4 skill.

Catalog connections: D01 market-data engineering (freshness and gap concepts). No algorithm is required for scheduling; the chapter owns an application policy.

## Scope and decisions

- `MARKET_DATA_MODE=demo|live`, `LIVE_REFRESH=eod|15m|5m|1m`, `LIVE_WATCHLIST`, `LIVE_BENCHMARK` and `LIVE_MAX_REQUESTS_PER_MINUTE` parsed once into a frozen, versioned runtime policy with validation errors that name the variable.
- A regular-hours exchange session calendar per IANA timezone (XNYS/XNAS 09:30–16:00 America/New_York, XLON 08:00–16:30 Europe/London; weekends closed). Holidays and half days are recorded as `not_modeled`, never asserted.
- A refresh scheduler that runs cycles on the cadence, skips closed sessions for intraday cadences, runs one end-of-day cycle after each close, and never overlaps cycles.
- A queued request budget (bounded concurrency, minimum spacing, per-minute cap) replacing fail-fast rejection for scheduled work; interactive calls keep their timeout.
- Provider health: last success, consecutive failures, exponential back-off with a ceiling, and a recovery event.
- Unsupported: streaming vendors, holiday calendars, pre/post-market trading decisions.

## Contracts and interface

`LiveRuntimePolicy { version, mode, cadence, periodMs, cacheTtlMs, freshnessSeconds, watchlist, benchmark, requestsPerMinute }`.

`RefreshCycle { id, sequence, policyVersion, mode, cadence, trigger: schedule|manual, scheduledAt, startedAt, completedAt, session, coversSession, status: completed|partial|failed, tasks[], health }` stored append-only. Skipped ticks are kept in the status decision log rather than stored as cycles.

API: `GET /live/status`, `GET /live/cycles`, `POST /live/cycles` (manual refresh, idempotent), `GET /live/stream` (server-sent events: `status` and `cycle`; later chapters add their own event types).

React: a live status chip in the top bar and a **Live runtime** desk showing policy, session state, cycle history and provider health.

## Planned implementation locations

`packages/contracts/src/live.ts`; `packages/core/src/domain/live` (policy, session calendar); `packages/core/src/use-cases/live-refresh-service.ts`; `packages/adapters/src/market-data/request-budget.ts`; `apps/api/src/http/live.ts`; `apps/web/src/features/live`.

## Tasks and commit checkpoints

1. **Freeze the live runtime policy and session calendar.** Parse environment into a policy; classify session state for exchange timezones including DST boundaries.

   Commit: `chapter-18 task-1: freeze live runtime policy and session calendar to make refresh cadence explicit`.

2. **Queue provider requests under a budget.** Add waiting, spacing and a per-minute cap with deterministic tests.

   Commit: `chapter-18 task-2: queue provider requests under a budget to respect the unofficial source`.

3. **Schedule refresh cycles with health and back-off.** Deterministic scheduler driven by an injected clock and timer; record cycles and health.

   Commit: `chapter-18 task-3: schedule refresh cycles with health evidence to make live data observable`.

4. **Expose and render the live runtime.** Routes, server-sent events and the React runtime desk.

   Commit: `chapter-18 task-4: expose and render the live runtime to show freshness decisions in the desk`.

## Acceptance and adversarial cases

- [x] `LIVE_REFRESH=1m` yields a 60 s period and a cache TTL below the period; an unknown cadence fails startup naming the variable.
- [x] 2026-03-09 14:00Z is inside XNYS regular hours (after the US DST change); 2026-03-06 14:00Z is before the open.
- [x] Saturday is `closed` (basis `weekend`); a weekday holiday reports regular hours with `holidays: not_modeled`, never asserted as a verified session.
- [x] A cycle that exceeds its period does not overlap the next; the skipped tick is recorded.
- [x] Three consecutive failures back off 1×, 2×, 4× the period up to the ceiling; one success resets health.
- [x] Demo mode never constructs a Yahoo transport.
- [x] Synthetic tests are deterministic; the live smoke check is separately labeled and opt-in.

## Validation execution plan

Unit tests for policy parsing, calendar, budget and scheduler with a fake clock; API tests through `inject()` for status, manual cycles and the event stream; a browser journey for the runtime desk in demo mode. Record commands and results in progress.

## Video walkthrough

1. Open with a stale price on a live screen and the question "how old is this number?".
2. Show the policy table: cadence, TTL, freshness and request budget move together.
3. Build in task order; break it by forcing provider failures and watch the back-off.
4. Show the runtime desk and the event stream updating.

## Exit and next boundary

A scheduled, observable refresh loop. Chapter 19 fills each cycle with validated live quotes.

## Evidence to fill during implementation

- Policy and calendar sources: NYSE/Nasdaq 09:30–16:00 ET and LSE 08:00–16:30 UK continuous trading; offsets resolved by `Intl` from IANA zones.
- Commands and observed results: recorded in docs/progress.md (Chapter 18 evidence).
- UI walkthrough/screenshots: Live runtime desk inspected at 1440 px and 390 px.
- Remaining limitations: holidays, half days and auctions unmodeled; one primary venue drives scheduling; server-sent events only (no websocket).
