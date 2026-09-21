# PRP 02 — Instrument identity and eligibility

Status: planned; implementation has not started.
Chapter: 2. Editorial duration estimate: 20 minutes.
Implementation starts when the maintainer explicitly requests this chapter.

## Learner promise

**Did we identify the actual security, listing, currency and trading unit?**

Search Yahoo candidates, resolve a provider alias to an internal instrument, and evaluate eligibility with provenance.

## Prerequisites and context

Chapter 1's mandate, API, React shell, repository ports and test harness.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D02-F03-A01 permanent mapping; D02-F03-A02 ticker chains; D02-F03-A03 share classes; D02-F04 point-in-time universe; D45-F01 eligibility.

Package boundary: D02 exists in the installed package; look up individual topic contracts before using them. Yahoo discovery is an application adapter. Provider metadata alone cannot prove permanent identity or full eligibility.

## Scope and decisions

Discover equities and ETFs, retain multiple listing candidates, and support a synthetic effective-dated alias case. Record unsupported types instead of forcing them into equity semantics.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

Instrument, InstrumentAlias, InstrumentEvidence and EligibilityDecision. Record requested/returned symbols, observed venue, quote currency and subunit, asset type, effective/known times, and evidence for tick/lot sizes. Unknown exchange MIC/tick size stays unknown.

API: GET /instruments/search; POST instrument resolution; GET instrument details; POST /universe/evaluations. The final route consumes mandate revision and instrument evidence revision.

React: Search results with exchange/currency/type, explicit candidate selection, identity evidence card, and eligible/ineligible/unresolved states. Show Yahoo mode and observation time.

## Planned implementation locations

packages/core/src/domain/instruments; packages/core/src/ports/market-data; packages/adapters/src/market-data/yahoo-finance; apps/api/src/http/instruments; apps/web/src/features/instruments.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Specify instrument evidence.** Freeze aliases, time validity, currency/unit scale, unknown fields and candidate-resolution rules.

   Commit after relevant checks: `chapter-2 task-1: specify instrument evidence to preserve identity across providers`.

2. **Add Yahoo instrument discovery.** Use the installed YahooFinance v4 class and verified search/quote contracts; normalize failures, enforce request budget, and keep vendor types inside the adapter.

   Commit after relevant checks: `chapter-2 task-2: add Yahoo instrument discovery to retrieve provider observations through one adapter`.

3. **Evaluate instrument eligibility.** Resolve aliases with explicit evidence and evaluate policy; test ambiguous listings and unsupported instruments.

   Commit after relevant checks: `chapter-2 task-3: evaluate instrument eligibility to connect identity to the mandate`.

4. **Build the instrument explorer.** Expose routes and React search/details/evidence views; demonstrate unavailable and unresolved states.

   Commit after relevant checks: `chapter-2 task-4: build the instrument explorer to make identity decisions reviewable`.

5. **Verify identity continuity.** Test symbol mismatch, changed ticker, overlapping aliases, missing tick evidence and provider failure; document opt-in live smoke evidence separately.

   Commit after relevant checks: `chapter-2 task-5: verify identity continuity to protect later prices and positions`.

## Acceptance and adversarial cases

- [ ] Two instruments with similar names or symbols cannot be merged without explicit evidence.
- [ ] A ticker change retains instrumentId while preserving alias effective intervals.
- [ ] A provider currency subunit cannot be treated as an equal numeric amount in the main currency.
- [ ] priceHint does not become legal tick size.
- [ ] No Yahoo access occurs during synthetic default tests; provider failure returns an unavailable state.
- [ ] Backend behavior is demonstrated through the actual API and React view.
- [ ] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [ ] Financial result provenance and limitations are visible in API output and the relevant screen.
- [ ] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Show two plausible listings returned by the same search and trace why only one matches the mandate and intended currency.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** A resolved instrument and provider port. Chapter 3 retrieves bars against that identity.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

A resolved instrument and provider port. Chapter 3 retrieves bars against that identity.

Update progress with completed tasks and commit references. Stop after this chapter and report its result. The next chapter starts only when the maintainer asks.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:
