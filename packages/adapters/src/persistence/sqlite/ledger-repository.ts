import {
  ledgerEventSchema,
  journalEntrySchema,
  type LedgerEvent,
  type JournalEntry,
} from "@portfolio-atlas/contracts";
import type { LedgerRepository } from "@portfolio-atlas/core";
import { SqliteDatabase } from "./database.js";
export class SqliteLedgerRepository implements LedgerRepository {
  constructor(private readonly db: SqliteDatabase) {}
  events(portfolioId: string) {
    return this.db.connection
      .prepare("SELECT payload FROM ledger_events WHERE portfolio_id=? ORDER BY sequence")
      .all(portfolioId)
      .map((row) => ledgerEventSchema.parse(JSON.parse(String(row.payload))));
  }
  journal(portfolioId: string) {
    return this.db.connection
      .prepare("SELECT * FROM journal_entries WHERE portfolio_id=? ORDER BY sequence")
      .all(portfolioId)
      .map((row) =>
        journalEntrySchema.parse({
          id: row.id,
          eventId: row.event_id,
          portfolioId: row.portfolio_id,
          sequence: row.sequence,
          kind: row.kind,
          lines: this.db.connection
            .prepare(
              "SELECT account,currency,side,amount FROM journal_lines WHERE entry_id=? ORDER BY line_number",
            )
            .all(row.id!),
        }),
      );
  }
  append(event: LedgerEvent, entry: JournalEntry) {
    if (!this.db.connection.isTransaction)
      throw new Error("Ledger writes require one enclosing command transaction.");
    ledgerEventSchema.parse(event);
    journalEntrySchema.parse(entry);
    if (
      event.id !== entry.eventId ||
      event.portfolioId !== entry.portfolioId ||
      event.sequence !== entry.sequence
    )
      throw new Error("Event and journal references must agree.");
    this.db.connection
      .prepare(
        "INSERT INTO ledger_events(id,portfolio_id,sequence,source_ref,payload) VALUES(?,?,?,?,?)",
      )
      .run(
        event.id,
        event.portfolioId,
        event.sequence,
        event.input.sourceRef,
        JSON.stringify(event),
      );
    this.db.connection
      .prepare(
        "INSERT INTO journal_entries(id,event_id,portfolio_id,sequence,kind) VALUES(?,?,?,?,?)",
      )
      .run(entry.id, entry.eventId, entry.portfolioId, entry.sequence, entry.kind);
    entry.lines.forEach((line, index) =>
      this.db.connection
        .prepare(
          "INSERT INTO journal_lines(entry_id,line_number,account,currency,side,amount) VALUES(?,?,?,?,?,?)",
        )
        .run(entry.id, index, line.account, line.currency, line.side, line.amount),
    );
  }
}
