# Chapter 10 — when did we know?

## Run the lesson

Start `npm run dev`, then open **Causal validation**. Run complete authored history at 10 bps. Inspect fold 1 momentum: the July 6 close decision fills July 7 at 13:30 UTC, not at the signal close.

USD 8,000 / 107 floors to 74 shares. Notional is 7,918; the 10 bps fee rounds to 7.92. Remaining cash is 2,074.08. At the final close of 112, holdings are 8,288 and NAV is **10,362.08**. At zero fees NAV is **10,370.00**. These independent amounts exercise the existing Chapter 5 journal and Chapter 6 valuation.

Compare the equal baseline and three fee levels. Each fold starts afresh at 10,000; do not compound them. Inspect the holdout: fitting ends July 16, before its July 17 first open. Rolling training changes the final training start to July 13. The implementation scores training data only.

## Break the assumptions

- Late filing: a future release blocks all performance.
- Missing session: one absent expected bar blocks; observations are never compressed.
- Delisted member: the original historical member remains. Its authored recovery of 5 produces a FIFO realized loss of 7,548 and a zero-fee final NAV of 2,452 in fold 1.
- Select a Chapter 3 current dataset: current observations cannot establish historical information or universe completeness.
- Restore a saved clean run. Its frozen settings, results, fixture and journal remain unchanged.

## Code and evidence

Read the [definition contract](10-definition-contract.md), then contracts/validation.ts, replay-fold.ts, validate-strategy.ts, ValidationService and the React desk. Task commits follow that order. The isolated replay posts through the same accounting projection and values the same book shape; it never modifies a real portfolio.

The package supplies D00 drawdown through an adapter. Installed 0.13.2 does not supply the planned catalog D40 backtester, so the bounded chronology is application code. No present-day Chapter 9 optimization result is inserted into historical training.

Focused unit/API and browser checks passed before final gates. Tests mutate future holdout prices and assert earlier results and fitted scores stay identical, prove next-open execution, compare costs, replay saved commands and verify the delisting journal. Desktop and 390px screenshots were inspected.

## Recording flow

1. Show the 6% training score and the later fill at 107.
2. Derive 74 shares and the 7.92 fee.
3. Open the exact journal and NAV evidence.
4. Compare independent folds, baseline and costs.
5. Break filing availability, then show the delisted member.
6. Explain synthetic evidence and repeated-testing limits.
7. Move to Chapter 11: translate a current target into reviewable quantities.

A 16-session teaching fixture cannot establish statistical significance, live tradability or profitability. There is no intraday fill realism, dividend/split processing in this simulator, or implied tax treatment.
