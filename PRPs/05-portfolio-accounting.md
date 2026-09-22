# PRP 05 — Cash, positions, tax lots and the book of record

Status: implemented; final chapter verification recorded in docs/progress.md.
Chapter: 5. Editorial duration estimate: 30 minutes.
Continuous full-course implementation is authorized.

## Learner promise

**Can every balance be rebuilt from the events that created it?**

Introduce durable accounting, journal entries, positions, cash reservations, and basic lots with replay and reconciliation.

## Prerequisites and context

Chapters 1–4 contracts; accounting policy and decimal representation must be frozen before coding.

Read [architecture](../docs/architecture/README.md), [data model](../docs/architecture/data-model.md), [API conventions](../docs/architecture/api-conventions.md), [integration rules](../docs/architecture/fintech-algorithms-integration.md), and [progress](../docs/progress.md).

Catalog connections: D30-F01 posting/idempotency/balance fold; D30-F03 reconciliation; D30-F05 correcting/versioned entries; D34-F01 cost basis; D43-F04 entitlements.

Package boundary: These operational domains are catalog backlog. Implement a bounded educational ledger here with primary accounting references and independent examples; do not pretend fintech-algorithms is a portfolio ledger.

## Scope and decisions

Cash-funded equity/ETF buys and sells, deposits/withdrawals, fees, splits, dividends, reversals, lot tracking and pending reservations. Freeze book fee policy separately from tax policy. No overdraft or margin model yet.

The listed behaviors are the chapter's target. Freeze precise formulas/policy conventions and primary sources in implementation notes before coding financial calculations. If an input or method is unsupported, return an explicit state and keep the evidence.

## Contracts and interface

Account, JournalEntry/Line, Money, PortfolioEvent, PositionSnapshot, TaxLot and CashBalance. Use explicit decimal arithmetic, transaction boundaries, idempotency keys, reversal references and per-currency balancing rules.

API: Post portfolio events; inspect journal/positions/cash; request a correction with reason and original entry reference. Posting is atomic.

React: Ledger explorer and cash/holdings views with settled/pending/reserved values, event drill-down, and an explicit correction flow.

## Planned implementation locations

packages/core/src/domain/accounting; packages/core/src/application/accounting; packages/adapters/src/persistence; packages/testing/fixtures/synthetic/accounting; apps/web/src/features/portfolio.

These paths describe future files/modules. The current repository contains ownership READMEs, not these implementations. Tests and fixtures live beside the domain or in packages/testing as appropriate.

## Tasks and commit checkpoints

1. **Define accounting policies and decimal rules.** Freeze debit/credit accounts, fee treatment, lot rules, currency/rounding and example derivations.

   Commit after relevant checks: `chapter-5 task-1: define accounting policies and decimal rules to make balances independently checkable`.

2. **Introduce durable repositories and migrations.** Select and pin the SQLite/decimal libraries, add transactional schema and migrations, and prove restart durability.

   Commit after relevant checks: `chapter-5 task-2: introduce durable repositories and migrations to preserve portfolio state across restarts`.

3. **Post and replay portfolio events.** Implement atomic idempotent journal posting, position/lot projections, action postings, reversals and reservations.

   Commit after relevant checks: `chapter-5 task-3: post and replay portfolio events to derive cash and holdings without duplicates`.

4. **Build the portfolio book views.** Expose journal/positions/cash endpoints and render auditable React tables and correction outcomes.

   Commit after relevant checks: `chapter-5 task-4: build the portfolio book views to explain every amount through its source event`.

5. **Verify financial invariants and recovery.** Test duplicate posting, partial transaction rollback, reversal replay, event ordering, decimals and persistence restart.

   Commit after relevant checks: `chapter-5 task-5: verify financial invariants and recovery to prevent silent balance corruption`.

## Acceptance and adversarial cases

- [x] 10,000 cash minus a 1,000 purchase and 5 expensed fee gives 8,995 cash and 10 shares.
- [x] A duplicate fill/event leaves quantity and cash unchanged.
- [x] A 2-for-1 split doubles quantity and halves per-share basis under the selected policy without creating cash.
- [x] A reversal plus replacement preserves the original audit trail and yields the independently computed balance.
- [x] A failed multi-line posting commits no partial journal.
- [x] An external deposit differs from a dividend receipt and trading profit in event classification.
- [x] Backend behavior is demonstrated through the actual API and React view.
- [x] Synthetic tests are deterministic; live-provider checks are separately labeled and opt-in.
- [x] Financial result provenance and limitations are visible in API output and the relevant screen.
- [x] Chapter changes pass the applicable typecheck, targeted tests, UI checks and documentation checks.

## Validation execution plan

Use the runtime scripts established in Chapter 1, adding a focused script when this chapter first needs a new kind of check. Record exact commands, exit results, fixture IDs, independent expected values, and UI evidence in docs/progress.md and chapter evidence notes. Do not claim success from the plan itself. Re-run the adjacent chapter's relevant regression only when the changed contract can affect it.

For a package call, include the looked-up export, pinned version, output fields and verification tier. For a new calculation, include an independent derivation and boundary cases. For provider behavior, distinguish schema-shaped fixtures from an observed live response.

## Video walkthrough

1. **Open with the portfolio decision.** Post the same fill twice: the first version of the teaching logic would double the position; the idempotency rule makes replay safe.
2. **Explain the contract.** Visualize the relevant records, units, clocks and financial invariant before implementation.
3. **Build in the task order.** Each task becomes a visible Git checkpoint. Explain why the backend owns the rule and how React receives its result.
4. **Break it deliberately.** Run at least one named adversarial case and show the resulting reason/state.
5. **Prove the result.** Compare with the independent fixture or expected state transition, then walk through the connected screen.
6. **Hand off.** Durable reconciled cash, lots and positions. Chapter 6 values the book using accepted market observations.

Use topic names in narration; catalog IDs remain in production notes. Mark any prebuilt demonstration or synthetic value clearly. Implementation time and recording duration are different estimates.

## Exit and next boundary

Durable reconciled cash, lots and positions. Chapter 6 values the book using accepted market observations.

Update progress and publish the verified chapter checkpoint. Continue to Chapter 6 under the full-build authorization.

## Evidence to fill during implementation

- Definition/policy sources and applicability:
- Final contract and fixture revisions:
- Package versions and verified exports:
- Commands and observed results:
- UI walkthrough/screenshots:
- Remaining limitations and next prerequisite:

Implementation guide and evidence: [Chapter 5](../docs/chapters/05-learning-guide.md).
