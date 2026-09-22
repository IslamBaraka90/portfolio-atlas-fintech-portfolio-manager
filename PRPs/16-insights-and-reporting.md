# PRP 16 — Management insights and the reporting desk

Status: implemented and verified; see docs/progress.md and docs/chapters/16-learning-guide.md.
Chapter: 16. Editorial duration estimate: 20 minutes.
Implementation starts when the maintainer explicitly requests this chapter.

## Learner promise

**Can a manager act on the report and trace every number?**

Assemble an immutable management report with holdings, cash, risks, performance, exceptions and explainable insights.

## Prerequisites and context

Chapters 5–15 snapshots and evidence. Missing sections must be visible; the report cannot imply unimplemented capabilities.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D16 performance; D41 reason codes/governance; D45-F03 reporting/lineage; D45-F05 records/evidence; D35 retrieval extension.

Package boundary: The desk and report orchestration are application features; the package supplies selected quantities. Regulatory report formats need separate jurisdiction-specific scope and evidence.

## Scope and decisions

A management report in React with printable HTML and machine-readable JSON/CSV export. Include as-of, mode, currency, coverage, method notes, versions and exception summaries. PDF may follow when print layout is verified.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

ReportSnapshot freezes reportId/revision, portfolio scope, asOf, data cutoff, input/result references, calculation versions, missing coverage, approval state and supersession. Insight links an observation to evidence and an allowed review action.

API: Generate/read reports and exports from the same frozen snapshot; compare revisions. Never recalculate individual export sections against fresh live data.

React: Overview, holdings/cash, quality, research, construction, orders, operations, risk, performance, attribution and report history navigation. Export preview shows missing sections and limitations.

## Planned implementation locations

packages/core/src/domain/reporting; packages/core/src/application/reporting; apps/api/src/http/reports; apps/web/src/features/reports.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Define the management report contract.** Specify snapshots, units, coverage, approval, lineage and export formatting.

   Commit after relevant checks: `chapter-16 task-1: define the management report contract to make every section share one as-of state`.

2. **Assemble traceable insights and sections.** Use deterministic statements tied to findings, not generated unsupported financial claims.

   Commit after relevant checks: `chapter-16 task-2: assemble traceable insights and sections to connect observations with supporting evidence`.

3. **Build the reporting desk and exports.** Add navigation, drill-down, print layout, JSON/CSV output and revision history.

   Commit after relevant checks: `chapter-16 task-3: build the reporting desk and exports to serve managers from one consistent snapshot`.

4. **Verify cross-section reconciliation.** Check NAV/holdings/performance ties, fixed-snapshot export parity, incomplete sections, print layout and supersession.

   Commit after relevant checks: `chapter-16 task-4: verify cross-section reconciliation to make issued reports reproducible`.

## Acceptance and adversarial cases

- [x] Holdings, cash and liabilities reconcile to the reported NAV under its valuation policy.
- [x] UI, JSON and CSV use identical frozen references and currency/rounding rules.
- [x] A later price correction creates a superseding revision without altering the issued snapshot.
- [x] A missing valuation or reconciliation break is visible in report coverage.
- [x] Every insight has an as-of time, source/result reference and bounded explanation.
- [x] A spreadsheet-targeted CSV export handles formula-like user text safely.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Click a headline return through attribution, valuation, ledger and source evidence, then export the same frozen result.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** An auditable reporting desk. Chapter 17 completes governance and recovery before wider deployment.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

An auditable reporting desk. Chapter 17 completes governance and recovery before wider deployment.

Update progress with completed tasks and commit references. Stop after this chapter and report its result. The next chapter starts only when the maintainer asks.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
