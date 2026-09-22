# PRP 08 — Expected returns, covariance and risk inputs

Status: implemented; see docs/chapters/08-learning-guide.md and docs/progress.md.
Chapter: 8. Editorial duration estimate: 20 minutes.
Implemented under the full-build authorization recorded in AGENTS.md.

## Learner promise

**Which risks and input uncertainty will the allocation actually depend on?**

Create a reproducible asset-ordered return matrix and covariance snapshot with estimation diagnostics.

## Prerequisites and context

Chapters 3–4 comparable time-aligned histories; Chapter 6 valuation/exposures; Chapter 7 research context.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D10-F04 sample/EWMA/shrinkage covariance; D10 historical volatility; D05 dependence; D09 time series; D00 statistics; D15 scenario concepts.

Package boundary: D10 and D00 are shipped. D05/D15 are planned at baseline. D14 is not required to construct and inspect risk inputs.

## Scope and decisions

Daily equity/ETF returns, explicit sample alignment, documented annualization, covariance and a simple expected-return assumption. Avoid adding a forecast model merely to fill an optimizer field.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

RiskModelSnapshot includes ordered instrument IDs, sample dates, return type, missing-data policy, frequency, annualization factor, estimator settings, expected-return assumption, covariance, diagnostics and revision.

API: Create/read risk models with explicit dataset references and settings. Invalid matrices or insufficient samples cannot be marked ready.

React: Correlation/covariance explorer, volatility and sample-coverage table, scenario input panel, and method sensitivity comparison.

## Planned implementation locations

packages/core/src/domain/risk-models; packages/core/src/application/risk-models; packages/adapters/src/analytics/fintech-algorithms; apps/web/src/features/risk.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Freeze return-matrix conventions.** Define sampling, asset ordering, simple/log returns, missing intervals and annualization.

   Commit after relevant checks: `chapter-8 task-1: freeze return-matrix conventions to make every covariance entry comparable`.

2. **Calculate risk inputs through verified methods.** Use looked-up D00/D10 methods with sample/rank diagnostics and explicit assumptions.

   Commit after relevant checks: `chapter-8 task-2: calculate risk inputs through verified methods to produce reproducible estimation snapshots`.

3. **Validate matrices and estimation scope.** Check symmetry, dimensions, finite values and positive-semidefinite requirements with tolerance and method-specific limitations.

   Commit after relevant checks: `chapter-8 task-3: validate matrices and estimation scope to prevent invalid inputs reaching construction`.

4. **Build the risk-model explorer.** Render asset order, correlations, sample coverage and parameter sensitivity.

   Commit after relevant checks: `chapter-8 task-4: build the risk-model explorer to show estimation uncertainty before optimization`.

5. **Verify independent covariance examples.** Use a hand-worked two-asset sample and singular/constant-series cases; freeze the resulting model contract.

   Commit after relevant checks: `chapter-8 task-5: verify independent covariance examples to establish a dependable D14 input boundary`.

## Acceptance and adversarial cases

- [x] A covariance matrix's asset order must match the expected-return vector exactly.
- [x] Identical returns generate perfect dependence where variances are nonzero; constant series produces an undefined correlation state.
- [x] Pairwise deletion cannot silently produce a matrix used as a valid PSD covariance estimate.
- [x] Daily and annual inputs cannot be mixed without an explicit conversion.
- [x] Historical mean returns are labeled estimates/assumptions, not guaranteed forecasts.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Show two equal-volatility assets whose joint risk changes as dependence changes, then trace the covariance inputs.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** A checked risk-model snapshot. Chapter 9 requires the user's D14 package release checkpoint.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

A checked risk-model snapshot. Chapter 9 requires the user's D14 package release checkpoint.

Publish this checkpoint and continue to Chapter 9. The 0.13.2 D14 release gate is already satisfied.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
