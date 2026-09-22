# Chapter 5 — A small, auditable book of record

## Accounting scope

This is an authored teaching book for cash-funded equities/ETFs. Trades settle immediately in this chapter; pending settlement is shown as zero, while explicit cash reservations reduce available cash. Chapter 13 will introduce settlement events. No overdraft, short selling, margin, borrowing, accrued income or tax determination is implicit.

Every monetary journal entry balances debits and credits in each currency. Cash and investment cost are debit-balance assets; contributed capital, dividend income and realized gains have credit balances; fees are expenses. [OpenStax's journal explanation](https://openstax.org/books/principles-financial-accounting/pages/3-5-use-journal-entries-to-record-transactions-and-post-to-t-accounts) supplies the double-entry foundation. The policies below are this application's explicit teaching choices.

| Event            | Debit                                       | Credit                                  |
| ---------------- | ------------------------------------------- | --------------------------------------- |
| Deposit          | Cash                                        | Contributed capital                     |
| Withdrawal       | Contributed capital                         | Cash                                    |
| Buy              | Investment cost, fee expense                | Cash                                    |
| Sell at gain     | Cash net of fee, fee expense                | Investment cost released, realized gain |
| Sell at loss     | Cash net of fee, fee expense, realized loss | Investment cost released                |
| Dividend receipt | Cash                                        | Dividend income                         |
| Standalone fee   | Fee expense                                 | Cash                                    |

Split, reserve and release events are auditable quantity/availability memos with no cash journal lines. A split preserves total lot cost, multiplies shares by the explicit new-shares/old-share ratio, and changes displayed unit cost. Dividend receipts are supplied payment evidence, not automatically inferred entitlement from a current position or Chapter 4 adjusted prices.

## Decimal and lot policy

Use decimal.js 10.6.0 with an isolated constructor, 40 significant digits and half-even rounding. Parse decimal strings, never a JavaScript-number money input. Supported book currencies are USD/EUR/GBP/EGP/SAR, all with two decimal money places in this bounded policy. Money input has at most two decimals and twelve whole digits; quantity and unit price have at most eight decimals and twelve whole digits. Reject unsupported precision instead of truncating it.

Trade notional is quantity × unit price, rounded once to currency cents. Fees are separately expensed, not capitalized into the lot. This is book policy; tax fee capitalization, wash sales and jurisdictional tax-lot rules are not claimed. FIFO consumes the oldest remaining lot. Partial disposal releases proportional remaining cost rounded to cents; the last disposal releases the exact remaining cents, conserving total cost. Displayed unit basis has eight decimal places. A split that requires rounding shares beyond eight decimals is unsupported until a cash-in-lieu policy exists.

Internal totals must remain within the stated money bound. Research algorithms may later receive checked finite number conversions; the ledger never uses binary numbers for arithmetic.

## Hand-derived case

Deposit 10,000.00. Buy 10 shares at 100.00 and expense a 5.00 fee: cash = 8,995.00; investment cost = 1,000.00; fee expense = 5.00. Assets of 9,995.00 equal contributed capital of 10,000.00 less the fee expense.

A 2-for-1 split gives 20 shares with total cost 1,000.00 and unit basis 50.00; cash is unchanged. Selling 4 shares at 55 with fee 1 gives net cash 219, releases cost 200, records realized gain 20 and fee expense 1. Remaining quantity is 16 and cost is 800.

A deposit is external capital, a dividend is income, and a realized gain is trading P&L. No classification is inferred from the sign of a cash movement.

## Order, reservations and corrections

Events retain source reference, effective time, recorded time and a server sequence. New events cannot precede the latest effective time or lie after recorded time. Historical imported events may precede workspace creation; their recorded-time evidence remains current. Source references are unique within a portfolio: identical replay does not repost, while changed terms conflict.

Reservations cannot exceed settled unreserved cash. A purchase can consume its named reservation; remaining reserved cash is released when that whole teaching fill completes. Purchases without a reservation must use available cash. Releases require an existing reservation. Partial fills and pending settlement remain later chapters.

Corrections append a reversal and optional replacement in one transaction, with the original event reference and a mandatory reason. The original stays immutable. This chapter permits correcting only the latest active event; historical corrections with dependent later events require a restatement workflow. Reversal lines exactly invert the original journal. Replaying effective unreversed events reconstructs positions, lots and reservations.

## Persistence and transactions

Use the SQLite engine bundled with the pinned Node 22.22 runtime via node:sqlite, not a guessed npm SQLite wrapper. State snapshots for mandates, portfolios, instruments, datasets, reviews and research runs are versioned JSON documents; events, journal entries and lines have explicit relational tables. Migrations are versioned and run transactionally. No user data is committed to Git.

Each synchronous command commits its state changes and replay record in one transaction. Provider I/O and source archiving complete before opening a short write transaction; async use cases return a synchronous commit step. A failure leaves no partial event, journal, correction or idempotency record. Exact source archives remain content-addressed files with hash verification.

References: [Node 22.22 SQLite API](https://nodejs.org/download/release/v22.22.0/docs/api/sqlite.html), [SQLite transactions](https://www.sqlite.org/lang_transaction.html), [atomic commit](https://www.sqlite.org/atomiccommit.html), and [decimal.js configuration](https://mikemcl.github.io/decimal.js/). The Node SQLite API is still marked active development in this runtime; the runtime requirement and restart tests make that choice explicit.

## Boundary to valuation

The book exposes a journal checkpoint, settled/reserved/available cash, actual share quantities, lots and cost. It does not call cost basis market value or calculate NAV. Chapter 6 combines this checkpoint with independently selected price/FX evidence. D14 is not needed for these accounting operations.
