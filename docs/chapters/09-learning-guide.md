# Chapter 9 — A solver result is not yet a portfolio decision

## Open with a rejected optimum

A mathematically optimal allocation can breach a position limit. Display its solver certificate beside the failed mandate check. Retain both facts: the selected problem was solved, and the returned candidate is not permitted by the portfolio policy.

Read the [released method inventory](09-method-inventory.md) and [definition contract](09-definition-contract.md) first.

## Follow the implementation

1. construction.ts in packages/contracts freezes methods, exact input revisions, statuses and constraint slacks.
2. The construction-engine port carries ordered means/covariance, current weights and explicit settings.
3. FintechConstructionEngine calls the installed equal-weight, GMV, inverse-volatility and turnover methods. It retains failure statuses and certificates.
4. The D00 risk diagnostic computes annual variance. Component variance contributions independently reconcile to the total.
5. constructTarget in the core converts decimal valuation amounts to normalized weights, proves simple capacity conflicts, applies a named covariance stress and audits every candidate.
6. ConstructionService joins the current mandate revision with exact risk/valuation references and commits immutable target evidence.
7. The HTTP routes and ConstructionDesk connect input selection, method comparison, constraint headroom and source inspection.

No optimizer substitute, clipped portfolio or hidden policy relaxation is used. Selected method scope is visible.

## Recording sequence

1. Create the standard mandate and a portfolio. Deposit 10,000 in its book.
2. Save a complete cash-only valuation at the current checkpoint.
3. Prepare AURA/HARB clean histories and adjustment runs. In Risk & assumptions create a simple-return Ledoit–Wolf snapshot with fictional annual assumptions 0.05 for both.
4. Open Construction & targets. Select the portfolio, exact valuation and risk snapshot.
5. Keep fixed cash 0.20 and compare all four methods.
6. Inspect equal weight: 40% AURA, 40% HARB, 20% cash; expected annual assumption 4%. Moving from cash requires 80% half-L1 turnover including cash and 80% risky traded notional.
7. Inspect minimum variance and inverse volatility. Explain their assumptions separately even when symmetric inputs produce the same weights.
8. Inspect turnover-constrained output. A successful solver can still violate cash/position limits because those extra mandate bounds are audited after the selected solver.
9. Compare a volatility stress factor of 2. Covariance and variance scale by 4; the source risk model remains unchanged.
10. Enter estimated costs of 1,000 bps with a 1% cost budget. The 8% estimated cost exceeds the budget and the candidate is rejected.
11. Select fixed cash zero. It conflicts with the mandate's 10% cash floor, producing an infeasible fixed-reserve problem.
12. Restore an earlier saved proposal. Read its frozen settings and source revisions; the editable form does not rewrite it.
13. Show the disabled Send orders action and unchanged book checkpoint.

Costs in this chapter are estimates on proposed notional. Actual quantities, available cash, fees and post-cost compliance are checked in later chapters.

## Independent results

- Equal-variance uncorrelated covariance 0.04 gives 50/50 and variance 0.02.
- Asymmetric covariance [[0.04,0.01],[0.01,0.09]] gives 8/11 and 3/11 by the independent derivative.
- Volatilities 0.1 and 0.2 give inverse weights 2/3 and 1/3.
- The turnover example with current [0.6,0.4], cap 0.1 and the documented means/covariance reaches [0.7,0.3].
- One turnover iteration remains max-iterations, and zero GMV iterations remains numerical_issue on the asymmetric case.
- Asset permutation preserves mapped weights.
- Capacity shortfalls are distinguished from one candidate's policy breach.
- Missing sector evidence, unsupported log-return inputs, wrong revisions and incomplete valuations cannot yield proposals.
- Repeating a target command returns the exact same snapshot without changing the ledger.

## Endpoints and commits

| Route                   | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| POST /api/v1/targets    | Calculate and freeze one method's result                 |
| GET /api/v1/targets     | List immutable target decisions                          |
| GET /api/v1/targets/:id | Inspect exact settings, input references and certificate |

| Task                                 | Commit           |
| ------------------------------------ | ---------------- |
| Released method inventory            | 05961ee          |
| Target and feasibility contracts     | 29e5fbb          |
| Baseline, GMV and inverse volatility | 25d9e4b          |
| Turnover, policy/cost audits and API | 7b6d36b          |
| Connected desk and final checks      | chapter-9 task-5 |

D14 is contract tier with application examples. The D03 baseline and D00 variance diagnostic are verified shared-fixture methods. Neither tier establishes real-world portfolio performance.

Desktop and 390px mobile captures are artifacts/chapter-9-desktop.png and chapter-9-mobile.png. The connected journey verifies costs, capacity conflict, restored snapshots, stress and no-order behavior. Final gate outcomes are in [progress](../progress.md).

## Continue to time-aware validation

Chapter 10 tests a bounded decision process with authored information availability and next-bar fills. Today's Yahoo data and current target snapshots cannot be relabeled as historical decisions.
