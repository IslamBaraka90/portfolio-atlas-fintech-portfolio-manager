# PRP 13 — Settlement, custody and reconciliation

Status: implemented and verified; see docs/chapters/13-learning-guide.md and docs/progress.md.
Chapter: 13. Editorial duration estimate: 20 minutes.
Implemented under the full-build authorization.

## Learner promise

**Do our records agree with the broker and custodian?**

Track obligations after fills and resolve synthetic reconciliation breaks with evidence and corrections.

## Prerequisites and context

Chapter 12 fills; Chapter 5 immutable accounting and Chapter 4 corporate-action references.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D43-F01 obligations; D43-F03 settlement; D43-F04 position reconciliation/entitlements; D30-F03 reconciliation/period close.

Package boundary: D43/D30 are catalog backlog. Implement an explicitly scoped operations model with a configured market/calendar policy; no universal settlement cycle is assumed.

## Scope and decisions

Synthetic broker/custodian statements, cash/securities obligations, partial/failed settlements, matched/unmatched records and corporate-action entitlement reconciliation.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

SettlementObligation, StatementSnapshot, ReconciliationRun, Break and Resolution. Match on stable identifiers and dates; keep ambiguous candidates, tolerance policy, source revisions and corrective journal references.

API: Import a synthetic statement, run reconciliation, inspect breaks, assign a resolution and post an approved correction.

React: Settlement calendar/queue, reconciled totals, unresolved break table, source comparison and resolution history.

## Planned implementation locations

packages/core/src/domain/settlement; packages/core/src/domain/reconciliation; packages/core/src/application/operations; apps/web/src/features/operations.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Specify obligations and matching policies.** Freeze calendars, settlement policy, identifiers, tolerances and ambiguous-match outcomes.

   Commit after relevant checks: `chapter-13 task-1: specify obligations and matching policies to distinguish traded from settled positions`.

2. **Track settlement events.** Handle partial/failure/completion events atomically with the existing ledger and reservations.

   Commit after relevant checks: `chapter-13 task-2: track settlement events to maintain cash and securities obligations`.

3. **Reconcile against independent statements.** Match exact references first, preserve ambiguity, and categorize quantity/cash/fee/action breaks.

   Commit after relevant checks: `chapter-13 task-3: reconcile against independent statements to surface unexplained differences`.

4. **Build the operations queue.** Render ownership, aging, evidence and correction workflow without silently editing balances.

   Commit after relevant checks: `chapter-13 task-4: build the operations queue to make breaks actionable and auditable`.

5. **Verify partial settlement and correction.** Test duplicates, missing statements, date boundaries and explicit reverse/repost behavior.

   Commit after relevant checks: `chapter-13 task-5: verify partial settlement and correction to prove the book agrees after resolution`.

## Acceptance and adversarial cases

- [x] A filled trade can remain unsettled; the UI shows both states.
- [x] One ambiguous statement line cannot clear two different fills.
- [x] A 1-share difference appears as an unresolved quantity break with both sources.
- [x] Resolving a break records the original discrepancy and any journal correction.
- [x] Replaying a settlement event never posts cash twice.
- [x] Configured holidays and market rules determine dates; T+1 is not hard-coded universally.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Compare the application's 10-share position with a custodian's 9-share record and trace the break to a partial settlement.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** Reconciled snapshots and operational exceptions. Chapter 14 monitors the portfolio continuously.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

Reconciled snapshots and operational exceptions. Chapter 14 monitors the portfolio continuously.

Update progress with completed tasks and commit references. Continue to Chapter 14 under the full-build authorization.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
