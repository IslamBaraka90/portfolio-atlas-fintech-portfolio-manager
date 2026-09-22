# Chapter 8 — Inspect the inputs before optimizing

## Opening demonstration

Two assets can have the same individual volatility and very different joint risk. First inspect their aligned return intervals, then covariance and correlation. A portfolio optimizer cannot repair missing dates or an unexplained currency conversion.

The [definition contract](08-definition-contract.md) freezes units, ordering, annualization, estimator differences and matrix tolerance.

## Code reading sequence

1. packages/contracts/src/risk-models.ts defines the frozen request and snapshot.
2. packages/core/src/ports/risk-engine.ts isolates the analytics dependency.
3. FintechRiskEngine verifies source revisions, currency, sessions and availability, then calls D00 returns and D10 estimators.
4. inspectCovariance in packages/core/src/domain/risk checks symmetry, finite dimensions, eigenvalues, rank and conditioning without replacing the matrix.
5. RiskService resolves exact adjustment and dataset revisions and commits the snapshot with idempotent replay.
6. apps/api/src/http/risk.ts exposes create/list/read operations.
7. RiskDesk renders input order, scenario assumptions, matrices, aligned intervals and method sensitivity.

A singular PSD model may be a valid descriptive result. It is labeled not positive definite. Chapter 9 checks the actual solver's requirements.

## Recording walkthrough

1. Capture clean AURA and HARB candles in Candle quality. Their clean teaching paths are intentionally identical.
2. Create a ready adjustment run for each in Actions & currency.
3. Open Risk & assumptions. Select AURA then HARB; the displayed order is the matrix order.
4. Keep simple returns, gross total return, sample covariance and 252 sessions/year.
5. Choose named annual scenarios and enter 0.08 for AURA and 0.04 for HARB. These are fictional assumptions, not forecasts.
6. Freeze the model. Inspect 11 return intervals, perfect correlation and rank 1 of 2.
7. Expand the exact interval rows and source hashes. Input revisions remain frozen when newer datasets arrive.
8. Compare Ledoit–Wolf on the same frozen inputs. The scaled-identity target changes the estimate and, for this fixture, produces rank 2. Explain the estimated shrinkage coefficient by opening the saved comparison model.
9. Compare EWMA and vary its decay. The zero-seed weight and zero-mean assumption are visible; this is not a fitted volatility model.
10. Reverse asset selection order and recreate. Scenario values follow named instruments; matrix labels follow the selected order.

Tables scroll inside their container on mobile. Desktop and 390px captures are artifacts/chapter-8-desktop.png and chapter-8-mobile.png.

## Independent expected results

Price paths A: 100,110,99,99 and B: 100,100,110,99 produce simple returns [0.1,−0.1,0] and [0,0.1,−0.1]. The centered cross-product sum is −0.01. Dividing by n−1 = 2 gives covariance −0.005. Both variances are 0.01, so correlation is −0.5. Annual covariance multiplies by 252.

The independent EWMA case uses two rows and decay 0.5. Its final diagonal is 0.000225 and 0.00015, off-diagonal −0.00005, observation mass 0.75 and zero-seed mass 0.25.

Constant price paths retain zero volatility and undefined correlation. An indefinite matrix, asymmetric matrix, negative variance, nonfinite cell or wrong dimension is rejected. Missing sessions, mixed currencies, mismatched revisions and future observations never enter a pairwise-deleted estimate.

## Routes and checkpoints

| Route                       | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| POST /api/v1/risk-models    | Freeze ordered inputs, settings and estimate |
| GET /api/v1/risk-models     | List saved estimates                         |
| GET /api/v1/risk-models/:id | Inspect one immutable model                  |

| Task                                  | Commit           |
| ------------------------------------- | ---------------- |
| Definition and contracts              | 2d5ba68          |
| Package-backed estimation             | 2b50d22          |
| Matrix admissibility                  | a90fe0b          |
| API and explorer                      | a8978a5          |
| Independent boundary checks and notes | chapter-8 task-5 |

All financial package calls use 0.13.2 verified shared-fixture methods. Application examples add independent arithmetic and source-boundary checks. See [progress](../progress.md) for the completed gate outcomes.

## Continue to construction

D14 is now available and verified at the release gate. Chapter 9 can compare supported portfolio-construction methods using these exact snapshots. It must retain return convention, currency, solver status and mandate feasibility rather than accepting every ready estimate blindly.
