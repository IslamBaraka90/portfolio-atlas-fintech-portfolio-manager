# PRP 11 — Rebalancing, cash flows and tax-lot policies

Status: planned; implementation has not started.
Chapter: 11. Editorial duration estimate: 20 minutes.
Implementation starts when the maintainer explicitly requests this chapter.

## Learner promise

**Which actual trades reach the target without violating cash and cost constraints?**

Build a reviewable rebalance proposal from current holdings, target weights, current prices, cash, lots and policy.

## Prerequisites and context

Chapters 5–6 current state; Chapter 9 target; Chapter 10 policy validation and cost assumptions.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D33-F03 calendar/threshold/cash-flow/minimum-trade rebalancing; D34 cost basis/harvesting; D14-F04 practical constraints.

Package boundary: D33/D34 are catalog backlog at baseline. Implement a bounded rebalance planner; adopt D14 methods only when their released contracts match. Tax policies remain simulations until a jurisdiction-specific specification is researched.

## Scope and decisions

Calendar and drift triggers, cash-first rebalance, minimum trades, fractional/whole-lot policy, fees and explicit residual cash. Add deterministic lot selection; no universal wash-sale or tax-rate claim.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

RebalanceProposal links a target and current journal/valuation revision to ordered proposed trades, chosen lots, projected cash, costs, residual drift, constraints and expiration. Stale proposals require re-evaluation.

API: Create/read/approve a proposal with expected revisions. Approval is distinct from order submission.

React: Before/after allocation, trade reasons, cost and cash bridge, lot preview, residual drift and approval summary.

## Planned implementation locations

packages/core/src/domain/rebalancing; packages/core/src/domain/tax-lots; packages/core/src/application/rebalancing; apps/web/src/features/rebalancing.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Define rebalance triggers and rounding.** Freeze drift basis, lot sizes, minimum trades, fees, cash reserve and proposal freshness.

   Commit after relevant checks: `chapter-11 task-1: define rebalance triggers and rounding to make target-to-trade translation explicit`.

2. **Create feasible trade proposals.** Translate targets using current revisions, include costs and do not round into a cash shortfall.

   Commit after relevant checks: `chapter-11 task-2: create feasible trade proposals to preserve cash and explain residual weights`.

3. **Add explicit lot-selection policies.** Implement a small documented policy set and label tax assumptions; keep unsupported jurisdiction rules disabled.

   Commit after relevant checks: `chapter-11 task-3: add explicit lot-selection policies to make realized gains inspectable`.

4. **Build the rebalance review.** Render current/target quantities, lots, cash bridge, constraints and approval state.

   Commit after relevant checks: `chapter-11 task-4: build the rebalance review to connect each proposed trade to its reason`.

5. **Verify cash and lot invariants.** Test cash inflows, whole-share rounding, minimum trade limits, stale targets, tied lots and insufficient cash.

   Commit after relevant checks: `chapter-11 task-5: verify cash and lot invariants to prevent a feasible target becoming infeasible trades`.

## Acceptance and adversarial cases

- [ ] A new contribution can reduce required sells under the cash-flow-first rule.
- [ ] After rounding and costs, available cash never falls below the mandate floor.
- [ ] Chosen lot quantities cannot exceed remaining lots.
- [ ] An unchanged already-balanced portfolio produces no trades.
- [ ] A changed position or price revision invalidates the old proposal's approval.
- [ ] Tax outputs show assumed policy/jurisdiction and cannot imply universal legal treatment.
- [ ] Backend behavior is demonstrated through the actual API and React view.
- [ ] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [ ] Financial result provenance and limitations are visible in API output and the relevant screen.
- [ ] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** A 50/50 target becomes an unaffordable rounded order list; add fees, lot rules and a cash reserve to produce an honest feasible proposal.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** An approved paper-trade proposal. Chapter 12 applies fresh pre-trade checks and simulates order lifecycle.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

An approved paper-trade proposal. Chapter 12 applies fresh pre-trade checks and simulates order lifecycle.

Update progress with completed tasks and commit references. Stop after this chapter and report its result. The next chapter starts only when the maintainer asks.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
