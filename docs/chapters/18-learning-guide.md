# Chapter 18 — know how fresh every number is

Part V turns the teaching desk into a live, local portfolio manager. This chapter builds the runtime every later live chapter uses: one configuration, one refresh loop and a visible record of every decision the loop makes.

## Configure the runtime

Copy `.env.example` to `.env` and choose:

| Variable                       | Values                     | Effect                                                        |
| ------------------------------ | -------------------------- | ------------------------------------------------------------- |
| `MARKET_DATA_MODE`             | `demo` (default) or `live` | Demo serves synthetic fixtures; live polls Yahoo Finance v4   |
| `LIVE_REFRESH`                 | `eod`, `15m`, `5m`, `1m`   | Scheduler period, provider cache lifetime and freshness limit |
| `LIVE_WATCHLIST`               | Comma-separated symbols    | Symbols polled alongside holdings (from Chapter 19)           |
| `LIVE_BENCHMARK`               | A Yahoo symbol, e.g. `SPY` | Probe symbol now; benchmark for risk and performance later    |
| `LIVE_MAX_REQUESTS_PER_MINUTE` | 1–120                      | Rolling cap on provider request starts for scheduled work     |

`parseLiveRuntime` in `packages/core/src/domain/live/runtime-policy.ts` reads these once. An unsupported value stops the server and names the variable; nothing falls back silently. The cadence table sets period, cache lifetime and freshness together. For `1m`, the period is 60 s, the cache lives 50 s and a price older than 180 s is stale. A cache that outlived the period would serve the last cycle's observation as new.

## Sessions and the refresh loop

`sessionState` classifies the primary venue from its IANA timezone with `Intl`, so New York and London daylight-saving changes need no hand-written offsets. On 2026-03-09 at 14:00Z New York is open (10:00 EDT); on 2026-03-06 at 14:00Z it is before the open (09:00 EST). Holidays and half days are **not modeled**: Thanksgiving reports regular hours with `holidays: not_modeled`, never a false certainty.

`LiveRefreshService` decides each tick:

1. A tick during a running cycle is skipped and logged; cycles never overlap.
2. After failures, ticks before `nextAttemptAt` are skipped. Back-off is period × 2^(failures − 1), capped. With `1m`: 60 s, 120 s, 240 s.
3. Intraday cadences run while the venue is open.
4. Every cadence runs one cycle for each completed session that has none yet, after the close plus a 15-minute grace. That captures final closes and the previous session when the desk starts mid-day.

Each cycle is stored once (`live-cycle` snapshots) with its session, the tasks it ran, their outcomes and the provider health that followed. Scheduled work goes through a queued `RequestBudget` with 250 ms spacing and the per-minute cap. Interactive lessons keep the original fail-fast budget.

## Walkthrough

Open **Live runtime** in the Live desk group. The top-bar chip reads the current mode and cadence. The desk shows the policy table, the primary session, provider health, the scheduler's recent decisions and the cycle history. Select **Refresh now**: the manual cycle appears in the table through the server-sent event stream (`GET /api/v1/live/stream`). The browser never calls Yahoo.

Break it deliberately in the API test: a failing quote transport records `NETWORK`, `backing_off` and a 60 s back-off; one success resets health. `npm run live:smoke` with `MARKET_DATA_MODE=live` runs one real cycle; demo tests never touch the network.

## Recording sequence

`.env` cadence table → DST session boundary → overlapping tick skipped → three failures and back-off → recovery → Refresh now in the desk → event stream update.

Chapter 19 replaces the provider probe with validated live quotes for the watchlist and holdings.
