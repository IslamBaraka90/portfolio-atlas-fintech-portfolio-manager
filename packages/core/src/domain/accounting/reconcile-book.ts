import type { Decimal } from "decimal.js";
import {
  bookSnapshotSchema,
  type LedgerEvent,
  type JournalEntry,
  type BookSnapshot,
} from "@portfolio-atlas/contracts";
import { BookDecimal as D, zero, money, signedMoney } from "./decimal.js";
import { projectBook, reversalEntry } from "./project-book.js";
export function reconcileBook(
  portfolioId: string,
  events: LedgerEvent[],
  journal: JournalEntry[],
  generatedAt: string,
): BookSnapshot {
  const projection = projectBook(events);
  const warnings: string[] = [];
  const sameLines = (left: JournalEntry, right: JournalEntry) =>
    JSON.stringify(left.lines) === JSON.stringify(right.lines) && left.kind === right.kind;
  const byEvent = new Map(journal.map((entry) => [entry.eventId, entry]));
  if (journal.length !== events.length || byEvent.size !== journal.length)
    warnings.push("Event and journal cardinality disagree.");
  for (const entry of projection.expectedJournal)
    if (!byEvent.has(entry.eventId) || !sameLines(entry, byEvent.get(entry.eventId)!))
      warnings.push("Active event does not match its journal: " + entry.eventId);
  for (const event of events)
    if (event.input.kind === "reversal") {
      const original = byEvent.get(event.input.originalEventId),
        reversal = byEvent.get(event.id);
      if (!original || !reversal || !sameLines(reversalEntry(original, event), reversal))
        warnings.push("Reversal does not exactly offset the original journal.");
    }
  const accounts = new Map<
    string,
    {
      currency: BookSnapshot["cash"][number]["currency"];
      account: BookSnapshot["accounts"][number]["account"];
      debits: Decimal;
      credits: Decimal;
    }
  >();
  for (const entry of journal) {
    const currencyBalance = new Map<string, Decimal>();
    if (
      entry.portfolioId !== portfolioId ||
      !events.some((event) => event.id === entry.eventId && event.sequence === entry.sequence)
    )
      warnings.push("Journal references disagree.");
    for (const line of entry.lines) {
      const amount = new D(line.amount),
        key = line.currency + ":" + line.account;
      const account = accounts.get(key) ?? {
        currency: line.currency,
        account: line.account,
        debits: zero(),
        credits: zero(),
      };
      if (line.side === "debit") account.debits = account.debits.plus(amount);
      else account.credits = account.credits.plus(amount);
      accounts.set(key, account);
      currencyBalance.set(
        line.currency,
        (currencyBalance.get(line.currency) ?? zero()).plus(
          line.side === "debit" ? amount : amount.negated(),
        ),
      );
    }
    if ([...currencyBalance.values()].some((value) => !value.isZero()))
      warnings.push("Unbalanced journal entry: " + entry.id);
  }
  for (const cash of projection.cash) {
    const account = accounts.get(cash.currency + ":cash");
    if (!(account ? account.debits.minus(account.credits) : zero()).eq(cash.settled))
      warnings.push("Cash projection and journal disagree.");
  }
  for (const currency of new Set([...accounts.values()].map((row) => row.currency))) {
    const investment = accounts.get(currency + ":investment_cost");
    const journalCost = investment ? investment.debits.minus(investment.credits) : zero();
    const lotCost = projection.lots
      .filter((lot) => lot.currency === currency)
      .reduce((sum, lot) => sum.plus(lot.costRemaining), zero());
    if (!journalCost.eq(lotCost)) warnings.push("Lot costs and investment journal disagree.");
  }
  const { expectedJournal, ...state } = projection;
  void expectedJournal;
  return bookSnapshotSchema.parse({
    portfolioId,
    checkpoint: events.at(-1)?.sequence ?? 0,
    generatedAt,
    policyVersion: "chapter-5.v1",
    settlementPolicy: "immediate_teaching",
    ...state,
    accounts: [...accounts.values()].map((row) => ({
      currency: row.currency,
      account: row.account,
      debits: money(row.debits),
      credits: money(row.credits),
      balance: signedMoney(row.debits.minus(row.credits)),
    })),
    reconciled: warnings.length === 0,
    warnings: [
      ...warnings,
      "Immediate teaching settlement; pending cash and quantities are zero.",
      "FIFO book lots expense fees separately; no jurisdictional tax treatment is asserted.",
    ],
  });
}
