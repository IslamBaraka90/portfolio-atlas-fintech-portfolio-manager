# PRP 06 — Valuation, NAV and an honest benchmark

Status: implemented; final verification recorded in docs/progress.md.
Chapter: 6. Editorial duration estimate: 20 minutes.
Continuous full-course implementation is authorized.

## Learner promise

**What is the portfolio worth, and what is a fair comparison?**

Freeze a valuation snapshot and a benchmark definition with aligned price, currency, return and time conventions.

## Prerequisites and context

Chapter 5 positions/cash; Chapters 3–4 valid prices, basis and FX.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D03-F02 weighting; D03-F04 return variants; D03-F06 eligibility/rebalance; D48-F07 price hierarchy/override; D00 returns.

Package boundary: D03 and D00 provide package methods. D48 valuation control is planned, so price hierarchy and override workflow are explicit application policy.

## Scope and decisions

Cash plus listed equity/ETF market values in one base currency. A bond ETF remains an ETF. Direct-bond accrued interest and derivative valuation await specialist scope.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

ValuationSnapshot references journal checkpoint, price/FX dataset revisions, policy, asOf and coverage. BenchmarkDefinition declares weights, constituent history, price/total return, gross/net convention, currency and rebalance rule.

API: Create/read valuation snapshots and benchmark definitions/results; return incomplete coverage with reasons instead of zero-filled NAV.

React: NAV bridge, holdings value table, stale/missing price indicators, source hierarchy, benchmark selector and matched-basis comparison.

## Planned implementation locations

packages/core/src/domain/valuation; packages/core/src/domain/benchmarks; packages/adapters/src/analytics/fintech-algorithms; apps/web/src/features/valuation.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Specify valuation and benchmark policies.** Freeze units, clocks, coverage, fee/income handling and benchmark variants.

   Commit after relevant checks: `chapter-6 task-1: specify valuation and benchmark policies to make comparisons economically consistent`.

2. **Value the portfolio snapshot.** Compute using decimal/checked conversion boundaries; preserve source and journal references.

   Commit after relevant checks: `chapter-6 task-2: value the portfolio snapshot to tie NAV to positions cash and market inputs`.

3. **Calculate the selected benchmark.** Use looked-up D03/D00 methods and explicitly record constituent/rebalance and return-basis assumptions.

   Commit after relevant checks: `chapter-6 task-3: calculate the selected benchmark to establish an appropriate baseline`.

4. **Build valuation and benchmark views.** Render NAV components, missing sources and comparison context.

   Commit after relevant checks: `chapter-6 task-4: build valuation and benchmark views to show why the total changed`.

5. **Verify NAV and comparison invariants.** Test valuation arithmetic, missing FX, stale prices, revision replay and return-basis mismatches.

   Commit after relevant checks: `chapter-6 task-5: verify NAV and comparison invariants to prevent false performance signals`.

## Acceptance and adversarial cases

- [x] 8,995 cash plus 10 shares at 110 gives NAV 10,095.
- [x] After an external deposit of 500, NAV is 10,595; the deposit is not profit.
- [x] Missing FX for a foreign holding produces incomplete coverage, not a zero holding.
- [x] A total-return portfolio must not be silently compared with a price-only benchmark.
- [x] Repeating a valuation against the same frozen references gives the same result.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Explain each part of the 10,095 NAV and expose how a mismatched benchmark can distort the comparison.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** Valuations and benchmark snapshots. Chapter 7 attaches research to the investable universe.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

Valuations and benchmark snapshots. Chapter 7 attaches research to the investable universe.

Publish the verified checkpoint and continue to Chapter 7 under full-build authorization.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:

Implementation guide: [Chapter 6](../docs/chapters/06-learning-guide.md).
