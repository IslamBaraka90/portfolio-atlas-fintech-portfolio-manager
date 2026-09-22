# PRP 12 — Pre-trade controls and paper execution

Status: implemented; see docs/chapters/12-learning-guide.md and docs/progress.md.
Chapter: 12. Editorial duration estimate: 25 minutes.
Implemented under full-build authorization.

## Learner promise

**What happens between an approved target and an actual fill?**

Introduce a deterministic paper broker with order states, pre-trade checks, reservations, partial fills and execution evidence.

## Prerequisites and context

Chapter 11 proposal and approval; Chapters 2–6 identity, prices and book; Chapter 10 execution timing convention.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D11 liquidity/spreads; D12-F03 order controls; D12-F04 lifecycle/partial fills; D13 execution/TCA; D45-F01 restrictions.

Package boundary: Selected D11–D13 algorithms exist. This package does not supply a brokerage service or order-management system. Verify which schedule/TCA functions exist; baseline D13 routing/TCA coverage is incomplete.

## Scope and decisions

Paper market/limit orders under an explicit daily simulation model. No live brokerage credentials or orders. Daily OHLC cannot prove queue priority or intrabar execution path.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

Order, OrderRevision, Fill, PreTradeDecision and CashReservation. Separate submitted/accepted/partially-filled/filled/cancel-pending/cancelled/rejected transitions, idempotency and original clientOrderId.

API: Submit a paper order from an approved proposal, query state, cancel/replace where supported, and receive deduplicated paper events.

React: Order blotter, controls verdict, fill history, remaining quantity, reserved cash, execution assumptions and rejection reasons.

## Planned implementation locations

packages/core/src/domain/orders; packages/core/src/application/execution; packages/adapters/src/execution/paper; apps/web/src/features/orders.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Define order states and simulation assumptions.** Freeze supported order types, price references, latency/cost conventions and transition rules.

   Commit after relevant checks: `chapter-12 task-1: define order states and simulation assumptions to make lifecycle and fill limits testable`.

2. **Enforce fresh pre-trade checks.** Re-evaluate eligibility, prices, exposure, revisions, quantity bounds and approvals; reserve resources atomically.

   Commit after relevant checks: `chapter-12 task-2: enforce fresh pre-trade checks to protect cash and mandate limits`.

3. **Implement deterministic paper fills.** Simulate declared fill/cancel behavior, deduplicate events, and post fills through the existing ledger.

   Commit after relevant checks: `chapter-12 task-3: implement deterministic paper fills to teach partial execution without pretending market realism`.

4. **Build the execution blotter.** Render lifecycle history, fill costs, remaining quantity and cancel/reject outcomes.

   Commit after relevant checks: `chapter-12 task-4: build the execution blotter to make order and cash state visible`.

5. **Verify lifecycle races and replay.** Test duplicates, out-of-order events, partial-fill/cancel races, insufficient cash and restart replay.

   Commit after relevant checks: `chapter-12 task-5: verify lifecycle races and replay to prevent double fills and stuck reservations`.

## Acceptance and adversarial cases

- [x] An order for 10 filled with 4 then 6 ends at 10, never 14 after an event replay.
- [x] A rejection releases its valid reservation; a partial fill preserves only the remaining commitment.
- [x] A stale price or revoked restriction blocks submission even if the target was previously approved.
- [x] A cancel request is not shown as cancelled until the declared acknowledgment transition.
- [x] A daily-bar model labels uncertain intrabar ordering and never claims observed market fills.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Follow one approved order through a partial fill and cancellation while cash and holdings update consistently.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** Paper fills and unsettled obligations. Chapter 13 completes settlement and reconciliation.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

Paper fills and unsettled obligations. Chapter 13 completes settlement and reconciliation.

Update progress with completed tasks and commit references. Continue through Chapter 17 under full-build authorization.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
