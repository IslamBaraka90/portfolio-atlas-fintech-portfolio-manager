import {
  bookStateSchema,
  ledgerEventSchema,
  correctionRequestSchema,
  type PostingInput,
  type LedgerEvent,
  type CorrectionRequest,
  type BookState,
} from "@portfolio-atlas/contracts";
import type { LedgerRepository } from "../ports/ledger-repository.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { PortfolioService } from "./portfolio-service.js";
import type { InstrumentService } from "./instrument-service.js";
import { Commands, canonical, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { normalizePosting, invalid } from "../domain/accounting/decimal.js";
import { activeEvents, postingEntry, reversalEntry } from "../domain/accounting/project-book.js";
import { reconcileBook } from "../domain/accounting/reconcile-book.js";
export class LedgerService {
  constructor(
    private readonly repository: LedgerRepository,
    private readonly portfolios: PortfolioService,
    private readonly instruments: InstrumentService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
  ) {}
  get(portfolioId: string): BookState {
    this.portfolios.getPortfolio(portfolioId);
    const events = this.repository.events(portfolioId),
      journal = this.repository.journal(portfolioId);
    return bookStateSchema.parse({
      events,
      journal,
      book: reconcileBook(portfolioId, events, journal, this.clock.now()),
    });
  }
  private requireReconciled(portfolioId: string) {
    const state = this.get(portfolioId);
    if (!state.book.reconciled)
      throw new ApplicationError(
        "BOOK_INVARIANT",
        "Book projections and journals disagree. Restore verified evidence before posting.",
      );
    return state;
  }
  atCheckpoint(portfolioId: string, checkpoint: number, asOf: string): BookState {
    this.portfolios.getPortfolio(portfolioId);
    const history = this.repository.events(portfolioId);
    if (!Number.isInteger(checkpoint) || checkpoint < 0 || checkpoint > history.length)
      throw new ApplicationError("INVALID_SNAPSHOT", "Journal checkpoint does not exist.");
    const events = history.slice(0, checkpoint);
    if (events.some((event) => Date.parse(event.recordedAt) > Date.parse(asOf)))
      throw new ApplicationError(
        "INVALID_SNAPSHOT",
        "Book evidence was recorded after the requested cutoff.",
      );
    const journal = this.repository
      .journal(portfolioId)
      .filter((entry) => entry.sequence <= checkpoint);
    return bookStateSchema.parse({
      events,
      journal,
      book: reconcileBook(portfolioId, events, journal, asOf),
    });
  }
  private append(input: PostingInput, now: string) {
    const state = this.requireReconciled(input.portfolioId);
    const existing = state.events.find((event) => event.input.sourceRef === input.sourceRef);
    if (existing) {
      if (canonical(existing.input) !== canonical(input))
        throw new ApplicationError(
          "IDEMPOTENCY_CONFLICT",
          "This source reference already describes different posting terms.",
        );
      return;
    }
    const time = Date.parse(input.occurredAt);
    if (
      time > Date.parse(now) ||
      time < Date.parse(state.events.at(-1)?.input.occurredAt ?? "1970-01-01T00:00:00Z")
    )
      invalid("Event time must not precede the latest event or lie after recorded time.");
    const instrument = "instrumentId" in input ? this.instruments.get(input.instrumentId) : null;
    if (instrument && "instrumentRevision" in input) {
      if (instrument.revision !== input.instrumentRevision)
        throw new ApplicationError(
          "REVISION_CONFLICT",
          "Instrument evidence changed before posting.",
        );
      if (
        instrument.identityStatus !== "synthetic_verified" ||
        !["equity", "etf"].includes(instrument.assetType)
      )
        invalid("This teaching book requires verified equity/ETF identity evidence.");
      if ("currency" in input && instrument.quoteUnit.currency !== input.currency)
        invalid("Posting currency must match the evidenced instrument currency.");
    }
    const event = ledgerEventSchema.parse({
      id: this.ids.next(),
      portfolioId: input.portfolioId,
      sequence: state.events.length + 1,
      recordedAt: now,
      instrumentSnapshot: instrument,
      input,
    });
    this.repository.append(event, postingEntry(state.events, event));
  }
  post(value: PostingInput, context: CommandContext): BookState {
    const input = normalizePosting(value);
    return this.commands.executeSync("ledger.post", input, context, () => {
      this.append(input, this.clock.now());
      return this.get(input.portfolioId);
    });
  }
  correct(value: CorrectionRequest, context: CommandContext): BookState {
    const parsed = correctionRequestSchema.parse(value);
    const input = {
      ...parsed,
      replacement: parsed.replacement ? normalizePosting(parsed.replacement) : null,
    };
    return this.commands.executeSync("ledger.correct", input, context, () => {
      const state = this.requireReconciled(input.portfolioId),
        active = activeEvents(state.events);
      const original = active.find((event) => event.id === input.originalEventId);
      if (!original || active.at(-1)?.id !== original.id)
        throw new ApplicationError(
          "CORRECTION_CONFLICT",
          "Only the latest active event can be corrected; dependent historical restatements are not implemented.",
        );
      if (
        input.replacement &&
        (input.replacement.portfolioId !== input.portfolioId ||
          state.events.some((event) => event.input.sourceRef === input.replacement!.sourceRef))
      )
        invalid("Replacement requires this portfolio and a new source reference.");
      const originalJournal = state.journal.find((entry) => entry.eventId === original.id)!;
      const now = this.clock.now(),
        id = this.ids.next();
      const reversal: LedgerEvent = ledgerEventSchema.parse({
        id,
        portfolioId: input.portfolioId,
        sequence: state.events.length + 1,
        recordedAt: now,
        instrumentSnapshot: original.instrumentSnapshot,
        input: {
          kind: "reversal",
          portfolioId: input.portfolioId,
          sourceRef: "reversal:" + id,
          // A correction is appended after every prior event, even when the
          // latest active event predates already-reversed events.
          occurredAt: state.events.at(-1)!.input.occurredAt,
          note: "Correction reversal",
          originalEventId: original.id,
          reason: input.reason,
        },
      });
      this.repository.append(reversal, reversalEntry(originalJournal, reversal));
      if (input.replacement) this.append(input.replacement, now);
      return this.get(input.portfolioId);
    });
  }
}
