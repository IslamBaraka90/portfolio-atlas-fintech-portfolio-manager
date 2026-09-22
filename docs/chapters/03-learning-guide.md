# Chapter 3 — Can these candles enter a calculation?

## Run the lesson

Run npm run dev, resolve AURA US common in Chapter 2, and open Candle quality. The default window is September 1–18, 2026 (end exclusive). Choose Break the candles. These are authored observations.

The desk retains 12 source rows: four accepted and eight quarantined. Filter HIGH_BELOW_BODY to see O=100, H=99, L=98, C=101. Filter MISSING_VOLUME: that row remains accepted for price-only analytics and visibly unsuitable for volume calculations. Filter DUPLICATE_SESSION: both copies remain quarantined. The missing September 15 session is unknown because halt/feed evidence was not supplied.

Choose Clean daily series: all 12 pass. Reload and select the saved adversarial dataset. The API owns the snapshots. Different command keys append revisions; a retry with the same key replays its original revision.

## Read in this order

1. [Definition contract](03-definition-contract.md): units, dates, finality and acceptance.
2. [Schemas](../../packages/contracts/src/market-data.ts) and [authored rows](../../packages/testing/src/candle-fixtures.ts).
3. [Yahoo chart adapter](../../packages/adapters/src/market-data/yahoo-finance/chart-provider.ts): preserve OHLCV, adjclose and the serialized SDK response.
4. [Quality adapter](../../packages/adapters/src/analytics/fintech-algorithms/market-quality.ts): package geometry plus application evidence rules.
5. [Use case](../../packages/core/src/use-cases/market-data-service.ts): archive before publishing, immutable lineage and replay.
6. [HTTP routes](../../apps/api/src/http/market-data.ts) and [React desk](../../apps/web/src/features/data-quality/DataQualityDesk.tsx).

## HTTP map

| Operation | Endpoint                        | Meaning                                                            |
| --------- | ------------------------------- | ------------------------------------------------------------------ |
| POST      | /api/v1/market-data/ingestions  | instrumentId/revision, from/to, scenario; requires Idempotency-Key |
| GET       | /api/v1/datasets                | Latest saved revisions                                             |
| GET       | /api/v1/datasets/:id?revision=1 | Exact historical snapshot                                          |
| GET       | /api/v1/datasets/:id/quality    | Latest row and coverage report                                     |

The running server saves raw JSON under .data/market-data by SHA-256. Unit/API tests use an isolated memory archive; a filesystem test independently verifies exact bytes and replay. Dataset records remain memory-only until Chapter 5.

## Package evidence

fintech-algorithms 0.13.1 validateBars (D01-F02-A01) and diagnoseGap (D01-F04-A01) are contract tier. Independent cases test geometry, negative/null/zero values, duplicates, dates, ordering, future observations and missing tick evidence. The application never supplies a fabricated legal tick or feed heartbeat.

Yahoo 4.0.2 chart uses the class client and validated array result. Search, quote and chart share one request budget at API composition. SDK fetch receives abort signals for cookie and data requests. Successful cache evidence retains its original time; failures remain retryable where appropriate. The adapter never switches providers.

## Live smoke

Opt in explicitly in PowerShell:

```powershell
$env:YAHOO_ENABLED = "true"
npm run yahoo:chart-smoke
Remove-Item Env:YAHOO_ENABLED
```

This command retrieves AAPL quote metadata and a daily September 1–18 window, writes a local ignored archive, and prints only provenance/counts. Live results are observations, not deterministic test assertions. Unknown finality, tick size and independent listing identity keep Yahoo rows quarantined. This is an honest boundary, not a fabricated successful calculation.

## Recording checkpoints

| Task | Commit                       | Demonstration                                           |
| ---- | ---------------------------- | ------------------------------------------------------- |
| 1    | 1e03352                      | Define a nullable source row and half-open window       |
| 2    | 05e64bd                      | Retrieve and archive without merging adjclose into OHLC |
| 3    | 43f24c1                      | Explain geometry and evidence failures independently    |
| 4    | b8236fe                      | Trace an impossible candle through API and React        |
| 5    | Find chapter-3 task-5 in Git | Verify adversarial, retry and live evidence             |

Open with the impossible candle, inspect its source index, show the acceptance invariant, run the targeted tests, and return to the chart gap. End with the source hash and parent revision that Chapter 4 will preserve.

## Limits and continuation

This is daily equity/ETF teaching data. No production exchange calendar, historical vendor availability, bar correction UI, intraday stream or retention service is claimed. Charts preserve known rejected/missing intervals. Unknown coverage cannot prove continuity. Chapter 4 is authorized next; D14 remains required only at the Chapter 9 gate.

### Recorded live observation

At 2026-09-22T11:13:58.412Z, Yahoo returned 12 AAPL daily rows from 2026-09-01T13:30:00Z through 2026-09-17T13:30:00Z, in USD. All 12 were quarantined for UNKNOWN_TICK, UNVERIFIED_IDENTITY and SESSION_UNKNOWN; zero accepted rows were fabricated. Source SHA-256: 60ebb2c7909aa81ee674f9f0a5899ff490f1fae42be26fd500ddb90ee15c561c. The raw response is locally archived and excluded from Git.
