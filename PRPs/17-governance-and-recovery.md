# PRP 17 — Governance, access and recovery

Status: planned; implementation has not started.
Chapter: 17. Editorial duration estimate: 15 minutes.
Implementation starts when the maintainer explicitly requests this chapter.

## Learner promise

**Can the system explain who changed a decision and recover a consistent book?**

Apply role-based access, approval and override controls, audit evidence, and recovery validation to the completed teaching workflow.

## Prerequisites and context

Chapters 1–16; threat model and intended deployment scope must be explicit. Early local-only assumptions are retired only after these gates pass.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D41 governance; D42 authentication/trust; D45 records; D49 access/API/security/recovery; D30 ledger integrity.

Package boundary: These are largely catalog plans and require application implementation and current primary security references. No package dependency substitutes for authorization or recovery design.

## Scope and decisions

Reader/analyst/operator/approver roles, separation of duties, effective-dated policy versions, overrides with reasons, protected API/session handling, backup/restore and incident runbooks. Public deployment is a separate user action.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

Actor, PermissionDecision, Approval, Override, AuditEvent and RecoveryCheckpoint. Include actor/resource/scope, policy revision, recorded time, reason, correlation ID and allowed state transition.

API: Enforce authorization on the server for every sensitive action; expose scoped audit and approval views. Define authentication integration appropriate to deployment rather than shipping hard-coded accounts.

React: Role-aware actions, approvals inbox, override explanation, audit explorer and recovery status. Hiding a button alone does not enforce permission.

## Planned implementation locations

packages/core/src/domain/governance; packages/core/src/application/governance; apps/api/src/http/security; apps/web/src/features/governance; docs/runbooks.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Define threat and access policies.** Map sensitive assets/actions to roles, tenant/account scope, approval separation and current primary references.

   Commit after relevant checks: `chapter-17 task-1: define threat and access policies to make authority and data boundaries explicit`.

2. **Enforce access and audit controls.** Add server authorization, authentication integration, override rules, input/session protections and redacted logs.

   Commit after relevant checks: `chapter-17 task-2: enforce access and audit controls to protect portfolio mutations and evidence`.

3. **Validate backup and deterministic recovery.** Document and test restore, replay, corruption detection and recovery checkpoints under the chosen storage.

   Commit after relevant checks: `chapter-17 task-3: validate backup and deterministic recovery to restore consistent journal and report state`.

4. **Complete the governed desk walkthrough.** Render approvals/audit views; run unauthorized-action, override, incident and restore scenarios, then record the course handoff.

   Commit after relevant checks: `chapter-17 task-4: complete the governed desk walkthrough to show a full auditable portfolio lifecycle`.

## Acceptance and adversarial cases

- [ ] An analyst cannot approve their own restricted action when separation of duties is required.
- [ ] Direct API calls cannot bypass hidden/disabled React controls.
- [ ] A resource ID from a different scope fails authorization.
- [ ] An override records actor, reason, prior/new state and policy revision.
- [ ] Backup restore plus event replay reconciles cash, quantities and frozen report references.
- [ ] Logs/exports contain no secrets, tokens or unrelated account data.
- [ ] Backend behavior is demonstrated through the actual API and React view.
- [ ] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [ ] Financial result provenance and limitations are visible in API output and the relevant screen.
- [ ] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Replay a disputed rebalance: identify the author, approval, policy revision and resulting fills, then restore a matching snapshot.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** The core teaching course is complete only after recorded evidence passes. Specialist asset modules and public deployment require separately requested work.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

The core teaching course is complete only after recorded evidence passes. Specialist asset modules and public deployment require separately requested work.

Update progress with completed tasks and commit references. Stop after this chapter and report its result. The next chapter starts only when the maintainer asks.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
