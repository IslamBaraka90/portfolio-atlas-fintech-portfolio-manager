# PRP 07 — Research signals, fundamentals and evidence

Status: implemented; see docs/chapters/07-learning-guide.md and docs/progress.md.
Chapter: 7. Editorial duration estimate: 20 minutes.
Implemented under the full-build authorization recorded in AGENTS.md.

## Learner promise

**What do we know about a holding, and when did we know it?**

Produce a small research panel combining selected price context, fundamentals and market participation with source and uncertainty.

## Prerequisites and context

Validated time-aligned data, instrument identity, and the established API/React pattern.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D04 breadth; D06–D09 technical context; D17 factors; D18 valuation/quality; D19 statements; D35 text; D46 earnings; D47 forecasts.

Package boundary: Selected D04/D06–D09/D18/D46 methods exist. D17/D19/D35/D47 remain partly or wholly planned. Look up each selected method; do not implement every indicator.

## Scope and decisions

One simple trend observation, one fundamentals diagnostic where inputs are sufficient, and a benchmark/breadth context card. Treat fundamentals as current observations unless historical availability is evidenced. News/ML are extension seams.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

ResearchObservation stores input dataset and filing references, observed/known time, method version, warm-up/unsupported reason, raw metric, interpretation bounds and confidence evidence.

API: Create/read research runs keyed to instrument set and cutoff; return supported and unavailable findings explicitly.

React: Instrument research panel with metric explanation, input provenance, time labels and a disabled recommendation action until a later mandate-aware workflow exists.

## Planned implementation locations

packages/core/src/domain/research; packages/core/src/application/research; packages/adapters/src/analytics/fintech-algorithms; packages/adapters/src/market-data/yahoo-finance; apps/web/src/features/research.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Select evidence-backed research methods.** Freeze exact quantities, input sufficiency, applicability and known-at rules.

   Commit after relevant checks: `chapter-7 task-1: select evidence-backed research methods to keep the first research panel interpretable`.

2. **Adapt company observations.** Use installed fundamentalsTimeSeries/selected quoteSummary contracts; avoid silently mixing fiscal periods or currencies.

   Commit after relevant checks: `chapter-7 task-2: adapt company observations to preserve financial-statement periods and source time`.

3. **Calculate chosen research observations.** Use verified imports, preserve warm-up/nulls and return method-specific limitations.

   Commit after relevant checks: `chapter-7 task-3: calculate chosen research observations to separate measurements from decision policy`.

4. **Build the research evidence panel.** Render calculation, source, period, freshness, uncertainty and unsupported states.

   Commit after relevant checks: `chapter-7 task-4: build the research evidence panel to let viewers inspect a metric's inputs`.

5. **Verify availability and interpretation.** Test missing statements, wrong periods, indicator warm-up and late revisions; record independent small examples.

   Commit after relevant checks: `chapter-7 task-5: verify availability and interpretation to prevent future information from entering a backtest`.

## Acceptance and adversarial cases

- [x] An indicator's warm-up slots keep their original timestamps.
- [x] A filing fetched today cannot be backdated to its period end as a knowledge timestamp.
- [x] A ratio with an unavailable or inapplicable denominator returns a reason instead of a misleading score.
- [x] A current Yahoo fundamental observation is not admitted to a historical strategy run without sufficient availability evidence.
- [x] Research results alone do not create orders.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** A strong-looking metric disappears when its statement was not yet known at the decision date; show the evidence cutoff.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** Timestamped research observations. Chapter 8 combines valid histories into a risk model.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

Timestamped research observations. Chapter 8 combines valid histories into a risk model.

The completed checkpoint is published as a stacked PR. Continue to Chapter 8 under the full-build authorization.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
