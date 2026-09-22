# Chapter 13 — prove the records agree

## Walkthrough

Create an authored UTC calendar in **Custody & reconciliation**, specifying coverage, eligible weekdays, holidays and business-day lag. Select it when submitting a Chapter 12 paper batch. Historical immediate fills retain their original policy.

The independent API example buys 10 shares at 390 with a fee of 3.90. Cash remains 10,000 settled, but economic and available cash become 6,096.10 because a 3,903.90 payable exists. Economic shares are 10; custody shares are zero. Nine delivered shares consume 3,513.51 cash, leaving settled cash 6,486.49 and one share / 390.39 pending. The last share completes delivery and leaves settled cash 6,096.10. NAV does not change merely because a payable settles.

Sales create receivables; they do not create spendable cash until acknowledgment. An active batch can receive its own settlement updates atomically, allowing a completed sale to fund its remaining buys. Reload the batch after operations changes its revision.

## Independent statements and breaks

Enter a separately authored synthetic statement JSON. The empty template deliberately does not copy the book. A statement declares full custody balances: omitted positions and cash mean zero. Select exact paper batch revisions for trade matching. Statements with the same source reference become immutable numbered revisions.

One statement line without a fill ID can have several candidates; it clears none. Repeating an explicit fill reference also clears none. Decimal quantity, net cash and fee comparisons are exact. Trade and value dates, currency and instrument identity are checked separately. Corporate-action receipt identity and amount are compared by evidence reference.

The browser example delivers nine shares, then imports a statement reporting ten. The one-share quantity break retains both sources. Assign an owner, explanation and evidence; approval records follow-up without clearing the frozen discrepancy.

## Correcting the book

Optional correction JSON uses portfolioId, originalEventId, reason and replacement (or null). Operations supports the latest cash or settlement event, with the same replacement kind. Dependent historical restatements and active-order corrections are rejected. Approval verifies the original reconciliation checkpoint, then appends a reversal and replacement in one transaction.

The independent API fixture records a 100 deposit against a 90 statement. Approved reverse/repost adds two journal events. The first reconciliation remains a cash break; a new run at checkpoint 3 matches 90 exactly. Statement revision 2 cannot rewrite revision 1.

## Evidence and limitations

The D43/D30 package surfaces are absent from installed 0.13.2. This chapter is a bounded application operations model, not an implementation of a market's legal settlement rules. Calendar dates are authored evidence, not exchange calendars.

Dividend checks compare evidenced receipts. Record-date entitlement inference, withholding rules, corporate-action elections and real custodian imports are explicitly unsupported. The screen and API preserve this limitation. No synthetic statement claims independent real-world custody verification.

Read the [definition contract](13-definition-contract.md), operations contracts, SettlementService, ReconciliationService and their focused tests. The connected browser journey covers calendar selection, deferred fill, partial custody, statement import, break review and approved follow-up.

## Recording sequence

Calendar → paper fill → payable and economic exposure → nine delivered shares → independent ten-share statement → exact/ambiguous matching → ownership and evidence → reverse/repost → fresh reconciliation.

Continue to Chapter 14 to monitor exposure and manage risk findings.
