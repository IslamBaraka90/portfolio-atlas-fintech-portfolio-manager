# PRP 10 — Time-aware backtesting and decision validation

Status: implemented; see docs/chapters/10-learning-guide.md and docs/progress.md.
Chapter: 10. Editorial duration estimate: 25 minutes.
Implemented under full-build authorization.

## Learner promise

**Would this decision process survive information timing, costs and new periods?**

Evaluate the portfolio policy using frozen datasets, realistic decision timing, explicit execution assumptions and time-separated evaluation.

## Prerequisites and context

Chapter 9 target construction; earlier journal, valuation and dataset contracts. Historical data suitability must be assessed first.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D40-F01 walk-forward/purging/embargo; D40-F02 bias controls; D40-F03 significance; D02-F04 universe; D13 cost analysis.

Package boundary: Baseline D40 contains score-validation methods, not the complete catalog backtesting domain. Implement a bounded simulator and relevant validation here; inspect upgraded package capability rather than infer exports.

## Scope and decisions

A transparent daily-bar allocation simulation with next-eligible-bar execution and costs; expanding/rolling evaluation and holdout. No claim of intraday queue/fill realism. Keep the execution port compatible with the later paper-broker chapter.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

ValidationRun freezes datasets, information cutoffs, universe membership, strategy/model versions, folds, trade timing, costs, seeds and result evidence. Each observation/decision/order/fill/valuation timestamp is distinct.

API: Run/read validation with immutable run identifiers and a suitability verdict. Unsupported historical inputs produce blocked/limited evidence rather than claimed bias-free results.

React: Timeline linking observations to decisions/fills, out-of-sample comparison, equity/drawdown, cost sensitivity and rejected dataset reasons.

## Planned implementation locations

packages/core/src/domain/validation; packages/core/src/application/validation; packages/testing/fixtures/synthetic/backtests; apps/web/src/features/validation.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Freeze the simulation timeline.** Document observation availability, signal cutoff, next-bar rule, rebalances, fees and benchmark timing.

   Commit after relevant checks: `chapter-10 task-1: freeze the simulation timeline to prevent information and fill-time leakage`.

2. **Replay a deterministic allocation policy.** Use the same contracts and ledger/valuation semantics, with a simple execution-model adapter rather than an unrelated P&L calculator.

   Commit after relevant checks: `chapter-10 task-2: replay a deterministic allocation policy to connect decisions to the existing accounting engine`.

3. **Add time-separated evaluation and bias checks.** Implement the appropriate folds, fit-only-on-training rules, availability/survivorship checks and cost sensitivity.

   Commit after relevant checks: `chapter-10 task-3: add time-separated evaluation and bias checks to measure performance on unseen periods`.

4. **Build the validation evidence view.** Render causal timelines and assumptions beside results; compare with a simple baseline.

   Commit after relevant checks: `chapter-10 task-4: build the validation evidence view to show why a backtest is accepted or limited`.

5. **Verify adversarial historical cases.** Test late fundamentals, delisted fixtures, gaps, fold contamination, zero-cost versus cost runs and unavailable data.

   Commit after relevant checks: `chapter-10 task-5: verify adversarial historical cases to prevent plausible but invalid performance`.

## Acceptance and adversarial cases

- [x] A decision based on a bar close cannot fill earlier within that bar under the declared daily model.
- [x] Changing a future observation cannot alter earlier decisions.
- [x] Training scalers/models cannot fit on the holdout period.
- [x] Today's Yahoo universe/history is not automatically a survivorship-safe historical universe.
- [x] A deliberately late filing fails the information cutoff gate.
- [x] Same frozen input and seed reproduce the same run; costs flow into accounting and reported returns.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Expose the extra return produced by a same-close fill, replace it with the declared next-bar rule, and compare the results.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** A validated or explicitly limited decision policy. Chapter 11 translates a current target into practical trades.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

A validated or explicitly limited decision policy. Chapter 11 translates a current target into practical trades.

Update progress with completed tasks and commit references. Continue through Chapter 17 under the full-build authorization.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
