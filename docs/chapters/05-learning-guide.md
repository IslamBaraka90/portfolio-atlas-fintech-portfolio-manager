# Chapter 5 — Rebuild every balance

## The question

Can the displayed cash, position and cost basis be reproduced from immutable events and their journal entries?

Read the [definition contract](05-definition-contract.md) first. This is a cash-funded, long-only equity/ETF teaching book. It expenses trade fees and applies FIFO to book lots. It makes no jurisdictional tax-policy claim.

## Read the code in this order

1. packages/contracts/src/accounting.ts: decimal strings, event variants, journal and snapshot shapes.
2. packages/core/src/domain/accounting/decimal.ts: half-even currency rounding, eight-place quantities, explicit bounds.
3. packages/core/src/domain/accounting/project-book.ts: cash, reservations, FIFO lots and event-derived postings.
4. packages/core/src/domain/accounting/reconcile-book.ts: independently compare the event projection with stored journals, including reversed history.
5. packages/core/src/use-cases/ledger-service.ts: identity revisions, source replay, chronological events and correction rules.
6. packages/adapters/src/persistence/sqlite: migration, foreign keys, transactions, immutable documents and decimal text.
7. apps/api/src/http/ledger.ts and apps/web/src/features/portfolio/PortfolioBook.tsx: transport and the connected learning desk.

SQLite holds decimal values as text. decimal.js 10.6.0 performs money arithmetic; financial values never pass through SQL REAL arithmetic. The app uses Node's bundled SQLite with WAL and explicit transactions; Node 22 labels the API experimental.

## Record the video

1. Create a portfolio in Mandate lab and resolve the synthetic USD AURA instrument.
2. Open Portfolio book. Deposit USD 10,000 at the displayed authored September timestamp.
3. Select buy, 10 shares, price 100, fee 5. Post: cash is 8,995 and acquisition cost is 1,000.
4. Open the buy event. Follow debits to investment cost 1,000 and fee expense 5, then the cash credit 1,005.
5. Replay the last command. The checkpoint stays at 2; the command result is replayed exactly.
6. Select that buy in the correction section. Change the posting form quantity to 8 and keep its new source reference. Reverse and replace: cash becomes 9,195, quantity 8, and four events remain.
7. Attempt an unaffordable buy. Show the focused error and unchanged book.
8. Demonstrate a 2-for-1 split on the original ten-share example: quantity 20, cost 1,000, unit basis 50, cash 8,995. A subsequent sale of four at 55 with fee 1 leaves cash 9,214, quantity 16 and cost 800.
9. Restart the normal API. Saved portfolios, identities, events, journals, command replay and dataset evidence survive.

Use fresh source references for distinct events. Currency amounts use two decimal places and quantities/prices at most eight. Supplied corporate-action receipt references are teaching evidence, not automatic entitlement calculations.

## HTTP commands

All mutation requests need an idempotency-key header. Reuse a key only with identical terms.

| Route                           | Purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| GET /api/v1/portfolios/:id/book | Events, journals and reconciled snapshot               |
| POST /api/v1/ledger/events      | One atomic event and its journal                       |
| POST /api/v1/ledger/corrections | Latest-active-event reversal with optional replacement |

The correction request contains portfolioId, originalEventId, a reason of at least ten characters, and replacement (posting input or null). A new source reference is required for replacement. Invalid replacement rolls back its reversal. Correcting dependent older active events requires an explicit restatement workflow outside this chapter.

## Independent checks

- 10,000 − 10 × 100 − 5 = 8,995.
- Reserve 80 of 100: available cash is 20 while settled cash stays 100.
- Three shares × 0.335 = 1.005, rounded half-even to 1.00. Releasing the final FIFO share consumes the exact remaining cost.
- Reversing a fee and then the earlier remaining deposit keeps append times monotonic.
- A database trigger failing on the second journal line leaves no event, entry, line or command replay record.
- Altering an original journal and its inverse together is detected even when their net balance remains zero.

## Commits and evidence

| Checkpoint                            | Commit           |
| ------------------------------------- | ---------------- |
| Decimal and accounting contract       | 0fab906          |
| Durable SQLite repositories           | e5138de          |
| Adopt released D14 for the full build | 63d2b22          |
| Posting and event replay              | 54ba297          |
| API and React book                    | 0ac06bc          |
| Recovery and final checks             | chapter-5 task-5 |

Local browser captures: artifacts/chapter-5-desktop.png and artifacts/chapter-5-mobile.png. These generated images are ignored by Git. See [progress](../progress.md) for commands and actual gate results.

## Limits and the next question

Pending settlement is zero under immediate teaching settlement. Reservations are separate from cash ownership. Chapter 13 introduces a settlement lifecycle. Chapter 6 values holdings at explicit accepted marks; cost basis alone is not market value. The simple reconciliation implementation favors inspectable replay over production-scale performance.
