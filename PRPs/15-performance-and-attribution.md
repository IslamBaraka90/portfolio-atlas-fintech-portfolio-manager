# PRP 15 — Performance measurement and attribution

Status: implemented and verified; see docs/chapters/15-learning-guide.md and docs/progress.md.
Chapter: 15. Editorial duration estimate: 25 minutes.
Implemented under the full-build authorization.

## Learner promise

**How much did we earn, and which decisions produced it?**

Compute cash-flow-aware performance and reconcile benchmark-relative attribution from frozen valuations and flows.

## Prerequisites and context

Chapters 5–6 event classification and valuation; Chapter 13 reconciliation; benchmark history and fee/FX conventions.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D16-F01 TWR/IRR/Dietz/linking; D16-F02 equity attribution; D16-F03 factors/risk; D16-F04 diagnostics; D13-F04 costs.

Package boundary: D16 is planned at baseline. Reuse matching D00 return/statistic methods where actually available, and research exact portfolio-performance conventions for new implementation.

## Scope and decisions

TWR with valuations at external flows; Modified Dietz only as a labeled alternative when appropriate; money-weighted return with solver diagnostics. Add one fully specified Brinson variant for a synthetic sector example before multi-period/factor extensions.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

PerformanceSnapshot and AttributionResult state period, valuation/flow timing, fee/tax/currency basis, benchmark revision, annualization applicability, method, component effects and residual.

API: Create/read performance and attribution runs referencing frozen valuations and flow records.

React: Performance curves, external-flow markers, method comparison, net/gross labels, benchmark basis and attribution waterfall with reconciled residual.

## Planned implementation locations

packages/core/src/domain/performance; packages/core/src/domain/attribution; packages/core/src/application/performance; apps/web/src/features/performance.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Define return and attribution conventions.** Freeze timing, linking, fee/FX treatment, annualization, selected Brinson formula and edge states.

   Commit after relevant checks: `chapter-15 task-1: define return and attribution conventions to separate investment results from external cash`.

2. **Calculate portfolio return methods.** Add TWR and bounded alternatives with independent examples and IRR convergence/uniqueness diagnostics.

   Commit after relevant checks: `chapter-15 task-2: calculate portfolio return methods to measure cash-flow-aware performance`.

3. **Attribute benchmark-relative results.** Implement the chosen one-period equity model and explain multi-period linking requirements.

   Commit after relevant checks: `chapter-15 task-3: attribute benchmark-relative results to reconcile decisions to observed return`.

4. **Build the performance explanation.** Render method, source, period, external-flow markers and residual reconciliation.

   Commit after relevant checks: `chapter-15 task-4: build the performance explanation to connect curves to flows and component effects`.

5. **Verify external flows and edge cases.** Test immediate deposits, empty/zero-capital periods, multiple IRR solutions, benchmark mismatches and attribution totals.

   Commit after relevant checks: `chapter-15 task-5: verify external flows and edge cases to avoid overstated performance`.

## Acceptance and adversarial cases

- [x] An immediate 500 deposit into NAV 10,095 produces NAV 10,595 and zero investment return over that no-market-change interval.
- [x] Fees reduce net return according to the frozen convention; gross results clearly exclude only the named costs.
- [x] TWR subperiods link geometrically, not by summing percentages.
- [x] An IRR with no root or multiple plausible roots reports the limitation instead of an arbitrary answer.
- [x] Attribution components plus residual reconcile to active return within the declared tolerance.
- [x] Short histories do not receive an unexplained annualized headline.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Show how a cash deposit creates a false return in a naive NAV ratio, then repair it using the recorded external flow.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** Reconciled performance and attribution. Chapter 16 assembles a consistent report snapshot.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

Reconciled performance and attribution. Chapter 16 assembles a consistent report snapshot.

Update progress with completed tasks and commit references. Continue to Chapter 16 under the full-build authorization.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
