# Chapter 6 — Explain value before claiming performance

## Start with the bridge

Deposit 10,000, buy ten AURA shares at 100, and expense a 5 fee in the Chapter 5 book. Cash is 8,995. A mark of 110 values the holding at 1,100, so NAV is 10,095. A later 500 deposit increases cash and contributed capital; NAV becomes 10,595 without earning that deposit as investment profit.

The [definition contract](06-definition-contract.md) separates money, share basis, price freshness, FX, benchmark weighting and return conventions.

## Follow the code

1. packages/contracts/src/valuation.ts and benchmarks.ts freeze request and evidence shapes.
2. packages/core/src/use-cases/ledger-service.ts rebuilds an exact checkpoint from original event prefixes.
3. packages/core/src/domain/valuation/select-mark.ts checks accepted rows, action reviews, split units and overrides.
4. value-book.ts values holdings and cash with decimal arithmetic; missing inputs keep totals incomplete.
5. packages/core/src/use-cases/valuation-service.ts joins immutable references inside an atomic snapshot command.
6. packages/adapters/src/analytics/fintech-algorithms/benchmark-engine.ts calls the looked-up D03/D00 methods.
7. packages/core/src/use-cases/benchmark-service.ts freezes definitions, computes results and checks comparison conventions.
8. apps/api/src/http/valuation.ts and apps/web/src/features/valuation connect the results to the desk.

The snapshot repository stores versioned evidence; each financial service owns and validates its schema. No vendor SDK enters React.

## Video walkthrough

1. Build the Chapter 5 purchase example, then ingest the clean AURA history in Candle quality.
2. Open Value & benchmark and select the portfolio. The desk displays the current journal checkpoint.
3. Choose the accepted September 15 row with close 110 and a ten-calendar-day teaching freshness budget.
4. Freeze valuation. Inspect 8,995 cash + 1,100 holdings = 10,095. Open the exact parent dataset and source hash.
5. Change freshness to one day. Freeze again: the historical mark is stale, holding value is unavailable and NAV is incomplete.
6. Restore ten days, post another 500 deposit in Portfolio book, return and refresh the checkpoint. Freeze: NAV is 10,595 and external contributions are 10,500.
7. In Actions & currency, create a research view for the clean dataset. Return to Value & benchmark.
8. Select that saved research history, choose price-only, and freeze a benchmark definition/result. The clean single-asset example grows from 101 to 112, or 11/101, with package rounding.
9. Select gross-total-return as the requested comparison convention. The mismatch remains visible. Matching currency and convention changes status to compatible, without asserting portfolio performance.
10. Open a saved earlier valuation after a later book/dataset revision. Its checkpoint, marks and totals remain unchanged.

Use separate portfolios when recording independent scenarios. The ten-day freshness setting exists for the authored September data; it is not a live execution policy.

## Independent adversarial cases

- Known foreign cash of EUR 90 without FX leaves USD NAV incomplete. A frozen 0.9 EUR/USD quote converts it to USD 100.
- Known zero foreign cash contributes exactly zero without requiring an invented FX quote.
- A quote before a posted split cannot value current share quantities automatically.
- An explicitly reasoned override preserves its asserted quote time and current-unit assumption.
- The API rejects nonexistent checkpoints and future cutoffs.
- Evidence recorded today cannot be valued as if already recorded earlier.
- A two-asset example with prices A: 100,120,120 and B: 100,80,100 returns 10% under equal initial weights and buy-and-hold. Daily resetting would return 12.5%; the implementation does not reset.
- Prices 100,90,99 with a 10 dividend on the middle date have a −1% price return and a +10% gross total return.
- Different constituent dates and duplicate listings remain unsupported.
- Restart preserves complete valuation and benchmark snapshots and exact command replay.

## Routes

| Route                                                          | Result                                       |
| -------------------------------------------------------------- | -------------------------------------------- |
| POST /api/v1/valuations                                        | Frozen complete/incomplete NAV with evidence |
| GET /api/v1/valuations and /:id                                | Saved valuation snapshots                    |
| POST /api/v1/benchmark-definitions                             | Immutable weighting and return conventions   |
| GET /api/v1/benchmark-definitions and /:id                     | Saved definitions                            |
| POST /api/v1/benchmarks                                        | Calculate a definitionId                     |
| GET /api/v1/benchmarks and /:id                                | Saved benchmark results                      |
| GET /api/v1/benchmarks/:id/comparison?basis=price&currency=USD | Explicit convention compatibility            |

Mutation requests use idempotency keys. Market-data, book and benchmark references retain their revisions rather than resolving silently to the latest version.

## Chronological checkpoints

| Task                                    | Commit           |
| --------------------------------------- | ---------------- |
| Policy and schemas                      | 92d48db          |
| Decimal NAV and evidence selection      | e78f52f          |
| Package-backed benchmark                | 03d39ca          |
| API and React desk                      | 73e7605          |
| Final invariants and recording evidence | chapter-6 task-5 |

The package is fintech-algorithms 0.13.2. Used D03/D00 methods are verified through shared fixture parity. This repository adds independent examples. Index methods round package outputs to six places; accounting remains decimal.

Browser evidence is locally generated in artifacts/chapter-6-desktop.png and artifacts/chapter-6-mobile.png. Both sizes were inspected; tables scroll within their containers. See [progress](../progress.md) for final commands and outcomes.

## Continue to research

These snapshots establish current value and a declared comparison basis. They do not compute flow-adjusted performance, imply historical availability, or generate trades. Chapter 7 adds price context, company observations and participation evidence with their own clocks.
