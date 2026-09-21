# PRP 09 — Portfolio construction and practical constraints

Status: planned; implementation has not started.
Chapter: 9. Editorial duration estimate: 30 minutes.
Implementation starts when the maintainer explicitly requests this chapter.

## Learner promise

**Which feasible portfolio expresses the mandate under uncertain inputs?**

Compare a simple allocation baseline with verified D14 construction methods and produce an explainable target snapshot.

## Prerequisites and context

Chapters 1 and 8; the user must announce D14 readiness and the package upgrade gate must pass before algorithm implementation.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D14-F01 mean-risk; D14-F02 risk allocation; D14-F03 robust/Bayesian; D14-F04 practical constraints; D39 optimization.

Package boundary: D14 is absent from baseline 0.13.1. Follow ADR 0003; resolve actual exported methods and supported solver scope before coding. Catalog names alone do not prove scalable solver capability.

## Scope and decisions

Begin with equal-weight, minimum-variance, and one risk-allocation comparison supported by the released package. Add expected-return/robust methods incrementally when verified. All four D14 families belong in the explanation; advanced methods remain labeled extensions until implemented.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

ConstructionRequest ties mandate, ordered risk model, cash convention, current holdings, cost assumptions and objective to TargetPortfolio. Output includes weights, feasibility, constraint slacks, objective, solver termination/tolerances, input uncertainty and source revisions.

API: POST /targets and comparison runs; GET target details. Rejected/non-converged/unsupported results never become executable targets.

React: Allocation comparison, risk contributions, binding-constraint table, cash weight, sensitivity view and infeasibility explanation. A target has an explicit proposal state.

## Planned implementation locations

packages/core/src/domain/construction; packages/core/src/application/construction; packages/adapters/src/analytics/fintech-algorithms; apps/web/src/features/construction.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Record the released D14 method inventory.** Complete the separately documented task-0 dependency upgrade first; then record the chapter's exact imports, fixtures, solver scope and compatibility contract.

   Commit after relevant checks: `chapter-9 task-1: record released D14 contracts to define the construction method inventory`.

2. **Define objective and feasibility contracts.** Freeze units, cash/gross/net constraints, dimensions, tolerances and solver outcomes.

   Commit after relevant checks: `chapter-9 task-2: define objective and feasibility contracts to connect optimization to the mandate`.

3. **Compare supported construction methods.** Use installed methods, propagate diagnostics and invalid states, and test a simple baseline before advanced methods.

   Commit after relevant checks: `chapter-9 task-3: compare supported construction methods to produce explainable feasible targets`.

4. **Add practical constraints and sensitivity.** Use supported cost/turnover/position bounds, vary uncertain inputs, and show binding constraints without silent relaxation.

   Commit after relevant checks: `chapter-9 task-4: add practical constraints and sensitivity to expose the costs of portfolio decisions`.

5. **Build and verify the construction desk.** Render comparisons and diagnostic tables; validate an independent small optimum, infeasible cases and no-order behavior.

   Commit after relevant checks: `chapter-9 task-5: build and verify the construction desk to let viewers inspect every target decision`.

## Acceptance and adversarial cases

- [ ] Symmetric uncorrelated equal-variance assets with a fully invested long-only minimum-variance objective yield 50/50 within the stated tolerance.
- [ ] Conflicting cash/position bounds produce infeasible status and no trade proposal.
- [ ] Asset permutation changes only output order, not the economic solution after mapping back.
- [ ] A solver's iteration limit cannot be reported as an optimal solution.
- [ ] Current-to-target turnover uses a frozen one-way/two-way definition.
- [ ] A target built with one model revision cannot silently reference another in the UI.
- [ ] Backend behavior is demonstrated through the actual API and React view.
- [ ] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [ ] Financial result provenance and limitations are visible in API output and the relevant screen.
- [ ] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Show an attractive unconstrained allocation violating the mandate, then expose the feasible target and the constraint that changed it.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** A proposed target portfolio, not orders. Chapter 10 validates the policy over time before an executable rebalance.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

A proposed target portfolio, not orders. Chapter 10 validates the policy over time before an executable rebalance.

Update progress with completed tasks and commit references. Stop after this chapter and report its result. The next chapter starts only when the maintainer asks.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
