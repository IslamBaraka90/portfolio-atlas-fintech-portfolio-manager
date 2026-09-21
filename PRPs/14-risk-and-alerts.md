# PRP 14 — Portfolio risk monitoring and actionable alerts

Status: planned; implementation has not started.
Chapter: 14. Editorial duration estimate: 15 minutes.
Implementation starts when the maintainer explicitly requests this chapter.

## Learner promise

**What changed enough to require attention?**

Evaluate current and proposed portfolio exposures, drawdown and selected loss/stress measures, then manage alert lifecycle.

## Prerequisites and context

Chapter 6 valuations, Chapter 8 risk inputs and Chapter 13 reconciled book snapshots.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D15 loss/tail/decomposition/stress; D33 drift; D45-F03 escalation; D41 governance; D00 risk statistics.

Package boundary: D15 is planned at baseline; selected foundational quantities exist in D00. Verify exact variants before reuse. Implement only researched risk measures with the required data and disclose approximation.

## Scope and decisions

Concentration, currency/sector exposures, drift, drawdown, selected historical loss measure and hypothetical shocks. Liquidity estimates need stated participation assumptions and sufficient volume data.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

RiskSnapshot and RiskFinding include exposure basis, lookback/horizon/confidence, return/loss sign conventions, quantile/interpolation method, scenario assumptions, breach rule revision and lifecycle.

API: Create/read risk runs, list findings, acknowledge/escalate/resolve with actor and reason. Acknowledgment does not mean the risk vanished.

React: Risk desk with exposure tables, stress waterfall, loss-distribution context, active alerts, freshness and acknowledgment history.

## Planned implementation locations

packages/core/src/domain/risk-monitoring; packages/core/src/application/risk-monitoring; apps/web/src/features/risk.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Freeze risk and breach definitions.** Document methods, units, confidence/horizon, concentration denominators and limit equality.

   Commit after relevant checks: `chapter-14 task-1: freeze risk and breach definitions to make thresholds reproducible`.

2. **Calculate risk snapshots and scenarios.** Use supported methods or documented bounded implementations with independent fixtures.

   Commit after relevant checks: `chapter-14 task-2: calculate risk snapshots and scenarios to connect exposures to potential losses`.

3. **Implement alert lifecycle.** Add deduplication, severity, acknowledgment and resolution semantics tied to snapshot revisions.

   Commit after relevant checks: `chapter-14 task-3: implement alert lifecycle to avoid noisy duplicate or silently cleared breaches`.

4. **Build and verify the risk desk.** Render scenario/limit inputs and alerts; test thresholds, stale data, shock arithmetic and alert replay.

   Commit after relevant checks: `chapter-14 task-4: build and verify the risk desk to support an evidence-based management action`.

## Acceptance and adversarial cases

- [ ] A synthetic -10% price shock on an unhedged 1,000 position changes its value by -100 under the stated linear equity model.
- [ ] NAV from 100 to 80 yields a 20% drawdown under the declared positive-loss convention.
- [ ] Repeated identical breaches update one finding rather than duplicating alerts.
- [ ] A stale valuation cannot clear a live breach as if it were a fresh observation.
- [ ] A VaR result states quantile method/horizon and never claims a maximum possible loss.
- [ ] Backend behavior is demonstrated through the actual API and React view.
- [ ] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [ ] Financial result provenance and limitations are visible in API output and the relevant screen.
- [ ] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** A portfolio with many holdings still has one dominant sector exposure; reveal it and show a reviewable alert.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** Actionable risk findings. Chapter 15 explains realized performance using the same frozen book.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

Actionable risk findings. Chapter 15 explains realized performance using the same frozen book.

Update progress with completed tasks and commit references. Stop after this chapter and report its result. The next chapter starts only when the maintainer asks.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
