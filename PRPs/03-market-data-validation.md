# PRP 03 — Market data ingestion and candle validation

Status: implemented; see [Chapter 3 guide](../docs/chapters/03-learning-guide.md).
Chapter: 3. Editorial duration estimate: 25 minutes.
Implementation starts when the maintainer explicitly requests this chapter.

## Learner promise

**Can these candles safely enter a calculation?**

Retrieve daily bars through Yahoo, retain raw evidence locally, normalize a dataset, and produce a row-level quality report before analytics.

## Prerequisites and context

Chapter 2 instrument identity and Yahoo adapter boundary.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D01-F02-A01 OHLC consistency; D01-F02-A04 stale quotes; D01-F03-A04 calendar alignment; D01-F04-A01 missing gaps; D01-F04-A04 schema drift; D01-F04-A05 availability.

Package boundary: D01 is available at the pinned version, but every call needs its own lookup. The OHLC validator is contract-tier and does not validate all dataset-level properties.

## Scope and decisions

Daily arrays with explicit requested window, exchange timezone, currency scale, provider basis and finality. Synthetic fixtures drive all expected results. Tick/volume/dollar bar construction is a later extension requiring actual trade data.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

MarketDataset, BarObservation, ValidationFinding and IngestionResult. Preserve nullable OHLCV and source row identity. Keep accepted/quarantined indexes, event and fetch clocks, basis and source hash. Analytics windows require an explicit gap policy.

API: POST /market-data/ingestions; GET /datasets/:id; GET /datasets/:id/quality. Server retrieves data; browsers never call Yahoo directly.

React: Candle table/chart, accepted versus quarantined rows, a reason filter, source/as-of/basis labels, coverage counts and a visibly interrupted chart at rejected intervals.

## Planned implementation locations

packages/adapters/src/market-data/yahoo-finance; packages/adapters/src/analytics/fintech-algorithms; packages/core/src/application/market-data; apps/web/src/features/data-quality.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Define dataset and quality contracts.** Freeze timestamp semantics, row identity, basis, finality, nulls, source references and error categories.

   Commit after relevant checks: `chapter-3 task-1: define dataset and quality contracts to preserve raw observation meaning`.

2. **Adapt Yahoo chart results.** Use installed chart declarations, separate adjclose, normalize dates and currency scale, and add bounded caching/retry behavior.

   Commit after relevant checks: `chapter-3 task-2: adapt Yahoo chart results to produce provider-neutral daily observations`.

3. **Run boundary and dataset validation.** Project OHLC rows to the verified validateBars contract; add schema/time/duplicate/volume checks and individually looked-up quality methods.

   Commit after relevant checks: `chapter-3 task-3: run boundary and dataset validation to quarantine unusable market observations`.

4. **Build the data-quality desk.** Expose ingestion and quality routes; render bad rows, chart gaps, and partial coverage without silently dropping evidence.

   Commit after relevant checks: `chapter-3 task-4: build the data-quality desk to explain what the calculations can trust`.

5. **Verify adversarial candle cases.** Test malformed dates, nulls, bad OHLC, duplicate intervals, mixed symbols, stale rows and incomplete sessions; record a live smoke separately.

   Commit after relevant checks: `chapter-3 task-5: verify adversarial candle cases to make the pipeline reproducible`.

## Acceptance and adversarial cases

- [x] O=100 H=99 L=98 C=101 fails OHLC geometry; O=100 H=102 L=99 C=101 passes.
- [x] A null close is quarantined and remains visible at its original timestamp.
- [x] Zero volume is distinguishable from missing volume; negative volume is invalid.
- [x] An unknown tick size cannot silently use 0.01 for every instrument.
- [x] An incomplete daily session does not become decision-ready merely because the row is last.
- [x] A provider timeout cannot yield a fake empty successful dataset or switch to synthetic mode.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Feed a visually plausible chart containing an impossible candle, then follow the exact row through adapter, validator and React rejection.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** A versioned dataset with quality evidence. Chapter 4 establishes corporate-action and FX comparability.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

A versioned dataset with quality evidence. Chapter 4 establishes corporate-action and FX comparability.

The continuous user authorization covers Chapter 4 next. Continue through Chapter 8, then stop at the Chapter 9 D14 gate.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
