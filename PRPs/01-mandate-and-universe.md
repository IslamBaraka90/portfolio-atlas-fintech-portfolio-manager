# PRP 01 — Mandate and investable universe

Status: implemented and verified on the Chapter 1 branch. See the [learning guide](../docs/chapters/01-learning-guide.md).
Chapter: 1. Editorial duration estimate: 25 minutes.
The maintainer requested this chapter. Subsequent chapters still require a separate request.

## Learner promise

**What is this portfolio allowed and expected to do?**

Create a portfolio with a versioned mandate and explain whether a synthetic candidate allocation satisfies it.

## Prerequisites and context

Chapter 0 planning foundation and dependency installation. No live data or D14 method is required.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D33-F01 profiling/suitability; D33-F02 goals; D45-F01 rules and eligibility; D00 data semantics.

Package boundary: D33 and D45 are catalog plans at the baseline. The mandate application and explicit teaching policies are implemented here; do not invent a suitability-engine npm export.

## Scope and decisions

Long-only equities, ETFs and cash; base currency; horizon; cash reserve; allowed asset types; maximum position/sector exposure; restricted IDs; versioned policy. Profile fields describe a teaching scenario and do not constitute regulated suitability approval.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

Mandate v1, Portfolio v1, ConstraintFinding and CandidateAllocation. Weights use a documented fraction convention. An invalid sum, absent classification, contradictory bounds, or unknown policy input produces a named outcome. Reasons distinguish invalid, unmet, and not-evaluable constraints.

API: POST/GET mandates and portfolios, plus POST /mandates/:id/evaluations. Use expectedRevision for edits and separate schema errors from a valid request that breaches a policy.

React: Portfolio creation form, mandate summary, synthetic allocation editor, and a constraint-results table with the exact rule, observed value, bound and reason. Include empty/loading/error states and a session-only storage badge.

## Implementation locations

packages/contracts/src/mandates.ts; packages/core/src/domain/evaluate-mandate.ts; packages/core/src/use-cases/portfolio-service.ts; packages/core/src/ports/portfolio-repository.ts; packages/adapters/src/persistence; apps/api/src/http/routes.ts; apps/web/src/features/mandates.

These modules are implemented. The use-cases directory makes application orchestration explicit; the original application ownership placeholder remains a pointer. Tests live in workspace test directories and shared synthetic fixtures live in packages/testing.

## Tasks and commit checkpoints

1. **Define mandate contracts.** Add schemas, examples and synthetic mandate/candidate records; freeze weight units, scope and reason codes.

   Commit after relevant checks: `chapter-1 task-1: define mandate contracts to make portfolio constraints explicit`.

2. **Wire the API and React workspace.** Add minimal runtime entry points, package exports/build boundaries, development commands, strict typechecks, and one health path; prove frontend imports exclude server dependencies.

   Commit after relevant checks: `chapter-1 task-2: wire the API and React workspace to make the first teaching slice runnable`.

3. **Implement mandate evaluation.** Add pure rules, a use case, fake clock, and an in-memory repository; reject malformed weights and report unknown classifications without a false pass.

   Commit after relevant checks: `chapter-1 task-3: implement mandate evaluation to explain feasible and conflicting allocations`.

4. **Expose portfolio and mandate routes.** Map typed request/response contracts, test HTTP behavior and repository lifetime, and record audit metadata.

   Commit after relevant checks: `chapter-1 task-4: expose portfolio and mandate routes to preserve revision and error semantics`.

5. **Build the mandate screen.** Connect React to real API results, label synthetic/session-only mode, and render accessible validation and reason states.

   Commit after relevant checks: `chapter-1 task-5: build the mandate screen to let learners inspect every decision`.

6. **Verify the first portfolio journey.** Run targeted domain/API/UI checks, fresh-start instructions, and a small end-to-end form/evaluation walkthrough; update progress and recording notes.

   Commit after relevant checks: `chapter-1 task-6: verify the first portfolio journey to establish a reproducible chapter checkpoint`.

## Acceptance and adversarial cases

- [x] A 60% single position breaches a 40% maximum; 40% is accepted at the declared equality boundary.
- [x] A 5% cash allocation fails a 10% floor; 10% passes; weights summing to 110% are invalid.
- [x] A minimum cash bound greater than the maximum feasible cash produces a conflict with a reason.
- [x] An unknown sector is not silently counted as unconstrained exposure.
- [x] Reusing a command/revision incorrectly produces an explicit conflict; restarting an in-memory process visibly loses session data.
- [x] The React screen shows server results and keyboard-accessible errors; no Yahoo or financial engine ships in its bundle.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Start with a polished-looking 60% holding that violates the mandate. Reveal the exact rule and reduce it to the accepted boundary.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** A runnable mandate slice with a candidate universe contract. Chapter 2 replaces synthetic instrument identity with a verified discovery workflow.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

A runnable mandate slice with a candidate universe contract. Chapter 2 replaces synthetic instrument identity with a verified discovery workflow.

Update progress with completed tasks and commit references. Stop after this chapter and report its result. The next chapter starts only when the maintainer asks.

## Evidence to fill during implementation

- Definition/policy sources and applicability: [authored teaching definition](../docs/chapters/01-definition-contract.md); inclusive basis-point limits, synthetic long-only allocations.
- Final contract and fixture revisions: schema v1, policy chapter-1.v1; DEMO-AURORA, DEMO-HARBOR and DEMO-INDEX.
- Package versions and verified exports: fintech-algorithms 0.13.1 and yahoo-finance2 4.0.2 remain pinned; no financial package/provider export is invoked in Chapter 1.
- Commands and observed results: [progress ledger](../docs/progress.md) records type/build, contract/domain/API and browser gates.
- UI walkthrough/screenshots: [learning guide](../docs/chapters/01-learning-guide.md) and [recording notes](../docs/video/chapter-01-recording-notes.md); browser suite generates desktop/mobile artifacts.
- Remaining limitations and next prerequisite: session memory, synthetic classifications, no authentication or live data. Chapter 2 instrument discovery is next; D14 remains gated.
