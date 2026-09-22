import type { JournalEntry, LedgerEvent } from "@portfolio-atlas/contracts";
export interface LedgerRepository {
  events(portfolioId: string): LedgerEvent[];
  journal(portfolioId: string): JournalEntry[];
  append(event: LedgerEvent, entry: JournalEntry): void;
}
