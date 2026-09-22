# Chapter 4 — Explain the price move

## Recording journey

1. Resolve AURA US common in Chapter 2. In Chapter 3, choose **Split + dividend lesson**, September 1–18, and ingest. All twelve authored candles pass.
2. Open **Actions & currency**, choose that dataset and review the action evidence.
3. Read the split ratio as new shares per old share. Read every dividend revision's availability time before the amount.
4. Choose September 9 and build research views. Toggle provider, split-adjusted, dividend total-return and FX views.
5. The first source close stays 100. Its split-adjusted price is 50. Gross dividend adjustment multiplies it by 50/52, giving 48.076923076923. At the ex-date, the 52-to-50 move plus 2 cash gives zero gross return.
6. Choose September 16: dividend revision 2 (2.5) changes the first total-return price to 47.619047619048. Choose September 21: cancellation removes the dividend factor, leaving 50.
7. Inspect the constant authored FX direction: USD 100 × 0.90 EUR/USD = EUR 90. Reversing the conversion divides by the rate.
8. Follow the immutable parent link. Its source price is still 100 and its SHA-256 is unchanged.
9. Inspect the independent basis-drift example: one 0.5 factor is explained by a newly knowable split; a 0.505 factor has an unexplained absolute log residual of log(1.01) × 10,000 ≈ 99.503309 bps.

This is current-price research using an action knowledge cutoff. A historical strategy must also establish historical price availability. The UI displays that limit before calculating.

## Code-reading order

- [Definition and primary sources](04-definition-contract.md).
- [Action and FX contracts](../../packages/contracts/src/corporate-actions.ts).
- [Authored price/action timeline](../../packages/testing/src/corporate-action-fixtures.ts).
- [Provider candidate normalization](../../packages/adapters/src/market-data/action-normalizer.ts).
- [Revision selection](../../packages/core/src/domain/select-actions.ts) and [FX direction/freshness](../../packages/core/src/domain/convert-fx.ts).
- [Package adjustment engine](../../packages/adapters/src/analytics/fintech-algorithms/adjustment-engine.ts).
- [Review use case](../../packages/core/src/use-cases/corporate-action-service.ts) and [immutable run use case](../../packages/core/src/use-cases/adjustment-service.ts).
- [React desk](../../apps/web/src/features/corporate-actions/CorporateActionsDesk.tsx).

## HTTP map

| Operation | Endpoint                                     | Result                                                        |
| --------- | -------------------------------------------- | ------------------------------------------------------------- |
| POST      | /api/v1/corporate-actions/reviews            | Read exact archived parent and retain all event revisions     |
| GET       | /api/v1/corporate-actions/reviews/:id        | Immutable review                                              |
| POST      | /api/v1/adjustment-runs                      | Calculate from reviewId, actionKnowledgeAt and targetCurrency |
| GET       | /api/v1/adjustment-runs                      | Latest run revisions                                          |
| GET       | /api/v1/adjustment-runs/:id?revision=1       | Reproduce an exact saved result                               |
| GET       | /api/v1/corporate-actions/basis-drift-lesson | Actual package diagnosis of fixed authored snapshots          |

All POST commands require an Idempotency-Key. Same-key replay returns the original result; a new cutoff appends a revision. Dataset and archive content are never adjusted in place. Archive reads verify SHA-256 before normalization.

## Package and independent evidence

Pinned fintech-algorithms 0.13.1: backward split calculate, cash-dividend total-return calculate and detectAdjustmentBasisDrift. All are verified tier (paired fixture parity). Application tests independently derive the 2-for-1 ratio, ex-date-close dividend factor, direct/reciprocal FX and 1% residual.

Yahoo event tests use schema-shaped fixtures. The earlier Chapter 3 live chart smoke archived a real SDK chart response; this chapter does not claim a separately verified live issuer corporate action. Yahoo amount/date/ratio observations stay candidates with missing authority, currency and entitlement evidence. They cannot alter holdings or certify provider OHLC basis.

## Chronological checkpoints

| Task | Commit                       | Teaching outcome                                                |
| ---- | ---------------------------- | --------------------------------------------------------------- |
| 1    | ae8bd4f                      | Definitions, clocks, FX direction and bounded scope             |
| 2    | e1530f2                      | Archived action candidates and revision timeline                |
| 3    | 6a78821                      | Split/dividend/FX calculations and independent examples         |
| 4    | a413ff5                      | Connected price-basis views and immutable parent navigation     |
| 5    | Find chapter-4 task-5 in Git | Archive integrity, drift diagnosis, replay and chapter evidence |

## Explicit limits

One split followed by ordinary same-currency dividends is supported. Multiple split chains, same-day ordering, rights/spin-offs, special distributions, net-of-tax returns and actual entitlement postings require their own contracts. Missing volumes block the split package call. Rejected/missing sessions block contiguous adjustment. Yahoo provider-returned basis stays unsupported for re-adjustment. The constant FX view is a scenario, not a historical FX series.

Chapter 5 is authorized next: durable cash, positions, lots, journal postings and reversals. Research adjustments never substitute for those book events.
