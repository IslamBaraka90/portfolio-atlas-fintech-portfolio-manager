# Chapter 2 — Instrument discovery and identity

## Run and explore

Run npm run dev and open the Instrument discovery chapter in the sidebar. Create a Chapter 1 mandate first if you want to evaluate eligibility. Search Aurora, then explicitly choose the US common or UK preferred listing.

The synthetic US security has a complete fictional rulebook and can be eligible under the sample USD mandate. The UK example is quoted in GBp, requires a 0.01 scale to GBP, and has unknown tick and lot evidence. It remains unresolved. Same issuer does not establish equal share rights.

Try the three alias buttons. AUR-OLD works before 2026-01-01, is unmapped at that instant, and AURA maps to the same DEMO-AURORA-US listing from that instant onward.

## Read the implementation

1. [Instrument contracts](../../packages/contracts/src/instruments.ts): separate security, listing, alias and evidence fields.
2. [Synthetic fixtures](../../packages/testing/src/instrument-fixtures.ts): fictional same-issuer securities and dated aliases.
3. [Provider port](../../packages/core/src/ports/instrument-provider.ts): no Yahoo fields cross this boundary.
4. [Yahoo adapter](../../packages/adapters/src/market-data/yahoo-finance/instrument-provider.ts): verified v4 search/quote calls, subunits, explicit unknowns and failure translation.
5. [Request budget](../../packages/adapters/src/market-data/request-budget.ts): cancellation, bounded concurrency and no unlimited queue.
6. [Identity adapter](../../packages/adapters/src/analytics/fintech-algorithms/identity-resolver.ts): D02-F03-A01 with real package input/output checks.
7. [Eligibility](../../packages/core/src/domain/instrument-eligibility.ts) and [use case](../../packages/core/src/use-cases/instrument-service.ts): evidence revisions and named reasons.
8. [HTTP routes](../../apps/api/src/http/instruments.ts) and [React explorer](../../apps/web/src/features/instruments/InstrumentExplorer.tsx): explicit candidate selection and visible unresolved states.

The shared Commands object now coordinates synchronous portfolio commands with asynchronous provider operations. Concurrent retries share a promise. A transient provider failure does not consume the idempotency key; a completed resolution replays its saved record.

## Routes

All routes use /api/v1. Mutations require the Idempotency-Key header from Chapter 1.

| Method | Path                          | Input / purpose                                                                    |
| ------ | ----------------------------- | ---------------------------------------------------------------------------------- |
| GET    | /instruments/search           | q and mode=synthetic or yahoo                                                      |
| POST   | /instruments/resolutions      | candidateId returned by search; evidence older than five minutes must be refreshed |
| GET    | /instruments                  | Saved records, with synthetic/yahoo/mixed envelope mode                            |
| GET    | /instruments/:id              | Current evidence revision                                                          |
| GET    | /instruments/:id/revisions    | Immutable evidence history                                                         |
| POST   | /universe/evaluations         | instrumentId, instrumentRevision, mandateId, mandateRevision                       |
| GET    | /instruments/aliases          | Fixed synthetic alias evidence                                                     |
| GET    | /instruments/alias-resolution | symbol, venueMic, validAt, knowledgeAt; whole-second UTC times                     |

Search can return available with zero candidates, or unavailable with a named failure. Resolution can return resolved, unresolved or unavailable. Eligibility can be eligible, ineligible or unresolved; stale evidence gets HTTP 409. Record creation is HTTP 201; unresolved/provider outcomes are HTTP 200 with explicit status.

## Enable live Yahoo deliberately

Default runtime and all normal tests make no Yahoo requests. Set YAHOO_ENABLED=true in your local .env and restart the API, then select Yahoo Finance in the explorer. Request timeout and maximum concurrency are configured in .env.example.

For the standalone smoke check in PowerShell:

```powershell
$env:YAHOO_ENABLED = "true"
npm run yahoo:smoke
Remove-Item Env:YAHOO_ENABLED
```

The script prints small metadata summaries, not a saved provider dataset. Yahoo availability is external and does not determine deterministic test success. Disabling live mode returns DISABLED; it never substitutes the synthetic catalog.

## Observed live evidence

On 2026-09-22 at 10:52:40.830Z, the pinned Yahoo Finance v4.0.2 adapter returned six AAPL search candidates: AAPL, AAPU, AAPL.TO, AAPW, APLY and AAPD. The quote observation at 10:52:42.126Z returned AAPL for the requested AAPL, reported USD with scale 1, and retained null legal tick size. Identity remained provider_observed.

This is a live observation of availability and adapter shape. It is not independent security-master verification, historical availability evidence or a redistribution license. No provider prices or bulk payload were committed.

## Verification and chronological checkpoints

Run npm run check, npm run typecheck, npm run test:unit, npm run build and npm run test:browser.

| Checkpoint | Commit / search                | What to explain                                                    |
| ---------- | ------------------------------ | ------------------------------------------------------------------ |
| Task 1     | 903c00d                        | Evidence contracts, subunits and two clocks                        |
| Task 2     | 351e36f                        | Yahoo v4 and synthetic providers; request budget                   |
| Task 3     | aa4484e                        | Package alias resolver and application eligibility                 |
| Task 4     | 7519510                        | API and React explorer; shared chapter navigation                  |
| Task 5     | Search chapter-2 task-5 in Git | Browser walkthrough, live evidence, retry checks and documentation |

The test suite checks symbol mismatch, two similar candidates, renamed ticker continuity, overlapping aliases, unavailable future evidence, subunit conversion, missing tick/MIC, stale revisions, cache lineage and bounded timeout behavior. Browser evidence includes desktop and 390px mobile captures under ignored artifacts.

## Recording flow

1. Open Aurora search and show two plausible listings. Ask why a name is insufficient.
2. Trace requested symbol, returned symbol, listing ID and security ID.
3. Convert 125 GBp to GBP 1.25; then show why priceHint cannot supply tick size.
4. Replay old/new ticker buttons and explain the half-open effective interval.
5. Follow the core port, Yahoo adapter, D02 package call, eligibility function and route.
6. Show eligible, unresolved and disabled-provider outcomes through the actual React screen.
7. Show the live smoke metadata separately from synthetic test evidence.
8. Hand off the saved identity and its evidence revision to Chapter 3 candle ingestion.

The current user authorization continues to Chapters 3–8 without a separate prompt. D14 still gates Chapter 9.
