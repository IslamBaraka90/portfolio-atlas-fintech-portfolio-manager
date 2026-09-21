# PRP 04 — Corporate actions, adjustment basis and FX

Status: planned; implementation has not started.
Chapter: 4. Editorial duration estimate: 20 minutes.
Implementation starts when the maintainer explicitly requests this chapter.

## Learner promise

**Was that price move economic, a corporate action, or a currency effect?**

Build separate provider-price, adjusted research, total-return and currency-converted views with action lineage.

## Prerequisites and context

Chapter 3 dataset contracts and Chapter 2 identity evidence.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D02-F01 split/dividend factors; D02-F02 complex distributions; D02-F04-A05 action status reconciliation; D01-F04-A06 provider basis drift; D24 FX.

Package boundary: D02 and the provider basis detector are available. D24 is planned at baseline; any FX helper implemented here requires an explicit quote-direction contract and primary methodology evidence.

## Scope and decisions

A documented 2-for-1 split, cash dividend, and one FX conversion in synthetic data. Explain rights/spin-offs as unsupported until separately specified. Provider observations are candidates, not automatic accounting postings.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

CorporateAction versions include status, ratio/amount, effective time, known time and source. FxObservation includes base/quote direction, units, clocks and freshness. Derived datasets retain their parent revision and adjustment method.

API: Corporate-action review and adjustment-run endpoints return separate series plus lineage and unsupported reasons.

React: Toggle price basis without changing the source dataset; show action markers, factor bridge, FX direction and excluded events.

## Planned implementation locations

packages/core/src/domain/corporate-actions; packages/core/src/domain/fx; packages/adapters/src/analytics/fintech-algorithms; apps/web/src/features/corporate-actions.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Freeze adjustment and FX definitions.** Document action ordering, factor conventions, provider observation limits and conversion direction.

   Commit after relevant checks: `chapter-4 task-1: freeze adjustment and FX definitions to prevent mixed price bases`.

2. **Normalize action candidates.** Map Yahoo event fields and add missing-term states; keep already-applied actions idempotent.

   Commit after relevant checks: `chapter-4 task-2: normalize action candidates to retain event status and revision evidence`.

3. **Compute documented history variants.** Use verified D02 exports; isolate adjclose, apply known-as-of guards, and reject ambiguous provider basis.

   Commit after relevant checks: `chapter-4 task-3: compute documented history variants to make economically comparable inputs`.

4. **Explain adjustments in React.** Render original/derived series, event/factor tables and FX calculations with parent dataset links.

   Commit after relevant checks: `chapter-4 task-4: explain adjustments in React to make continuity and currency effects visible`.

5. **Verify continuity and replay.** Add hand-derived split/FX examples, revised/cancelled event cases and basis-drift checks.

   Commit after relevant checks: `chapter-4 task-5: verify continuity and replay to avoid double adjustments and hindsight`.

## Acceptance and adversarial cases

- [ ] A 2-for-1 split maps a pre-event 100 price to 50 under backward price adjustment; holdings posting is deferred to Chapter 5.
- [ ] USD 100 at a stated 0.90 EUR per USD rate equals EUR 90; reversing direction must use the reciprocal.
- [ ] An event known after the decision cutoff is excluded from that historical run.
- [ ] A dividend-adjusted series plus a separate dividend credit cannot be counted twice in the same performance calculation.
- [ ] Changing the source dataset or action revision changes the derived revision.
- [ ] Backend behavior is demonstrated through the actual API and React view.
- [ ] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [ ] Financial result provenance and limitations are visible in API output and the relevant screen.
- [ ] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** A 50% apparent loss disappears after a correctly evidenced split adjustment; then show why that adjustment alone cannot update the portfolio's share count.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** Comparable series and action candidates. Chapter 5 books actual portfolio events separately.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

Comparable series and action candidates. Chapter 5 books actual portfolio events separately.

Update progress with completed tasks and commit references. Stop after this chapter and report its result. The next chapter starts only when the maintainer asks.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
