import {
  statementInputSchema,
  statementSnapshotSchema,
  reconciliationRequestSchema,
  reconciliationRunSchema,
  resolutionRequestSchema,
  resolutionSchema,
  paperBatchSchema,
  type StatementInput,
  type ReconciliationRequest,
  type ReconciliationRun,
  type ResolutionRequest,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { LedgerService } from "./ledger-service.js";
import type { PortfolioService } from "./portfolio-service.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { BookDecimal as D, money } from "../domain/accounting/decimal.js";
import { reconcileStatement } from "../domain/reconciliation/reconcile-statement.js";
export class ReconciliationService {
  constructor(
    private store: SnapshotRepository,
    private ledger: LedgerService,
    private portfolios: PortfolioService,
    private clock: Clock,
    private ids: IdFactory,
    private commands: Commands,
  ) {}
  statements() {
    return this.store.all("statement").map((v) => statementSnapshotSchema.parse(v));
  }
  statement(id: string, revision?: number) {
    const value = this.store.get("statement", id, revision);
    if (!value) throw new ApplicationError("NOT_FOUND", "Statement revision not found.");
    return statementSnapshotSchema.parse(value);
  }
  runs() {
    return this.store.all("reconciliation").map((v) => reconciliationRunSchema.parse(v));
  }
  run(id: string) {
    const value = this.store.get("reconciliation", id, 1);
    if (!value) throw new ApplicationError("NOT_FOUND", "Reconciliation not found.");
    return reconciliationRunSchema.parse(value);
  }
  resolutions() {
    return this.store.all("resolution").map((v) => resolutionSchema.parse(v));
  }
  import(value: StatementInput, context: CommandContext) {
    const input = statementInputSchema.parse(value);
    return this.commands.executeSync("statement.import", input, context, () => {
      this.portfolios.getPortfolio(input.portfolioId);
      if (
        Date.parse(input.asOf) > Date.parse(this.clock.now()) ||
        input.trades.some((t) => t.tradeDate > input.asOf.slice(0, 10))
      )
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "Statement cutoff or trade dates are future.",
        );
      const previous = this.statements().find(
        (s) => s.portfolioId === input.portfolioId && s.sourceRef === input.sourceRef,
      );
      const result = statementSnapshotSchema.parse({
        ...input,
        id: previous?.id ?? this.ids.next(),
        revision: (previous?.revision ?? 0) + 1,
        importedAt: this.clock.now(),
      });
      this.store.append("statement", result.id, result.revision, result);
      return result;
    });
  }
  create(value: ReconciliationRequest, context: CommandContext) {
    const request = reconciliationRequestSchema.parse(value);
    return this.commands.executeSync("reconciliation.create", request, context, () => {
      const statement = this.statement(request.statement.id, request.statement.revision),
        book = this.ledger.atCheckpoint(statement.portfolioId, request.checkpoint, statement.asOf);
      if (!book.book.reconciled)
        throw new ApplicationError(
          "BOOK_INVARIANT",
          "Rebuild a reconciled journal before external matching.",
        );
      const expectedTrades: ReconciliationRun["expectedTrades"] = [];
      for (const ref of request.batches) {
        const raw = this.store.get("paper-batch", ref.id, ref.revision);
        if (!raw) throw new ApplicationError("NOT_FOUND", "Paper batch revision not found.");
        const batch = paperBatchSchema.parse(raw);
        if (
          batch.portfolioId !== statement.portfolioId ||
          Date.parse(batch.updatedAt) > Date.parse(statement.asOf)
        )
          throw new ApplicationError(
            "INVALID_SNAPSHOT",
            "Batch portfolio or availability differs from statement cutoff.",
          );
        for (const order of batch.orders)
          for (const fill of order.fills) {
            if (!book.events.some((e) => e.id === fill.ledgerEventId))
              throw new ApplicationError(
                "INVALID_SNAPSHOT",
                "Selected fill is outside the journal checkpoint.",
              );
            expectedTrades.push({
              lineId: fill.id,
              fillId: fill.id,
              instrumentId: order.instrumentId,
              side: order.side,
              currency: batch.proposal.target.mandate.baseCurrency,
              quantity: fill.quantity,
              netCash: money(
                order.side === "buy"
                  ? new D(fill.notional).plus(fill.fee)
                  : new D(fill.notional).minus(fill.fee),
              ),
              fee: fill.fee,
              tradeDate: fill.at.slice(0, 10),
              valueDate: fill.dueDate ?? fill.at.slice(0, 10),
            });
          }
      }
      const result = reconciliationRunSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: this.clock.now(),
        portfolioId: statement.portfolioId,
        request,
        statement,
        book,
        expectedTrades,
        ...reconcileStatement(statement, book, expectedTrades),
        policyVersion: "chapter-13.v1",
      });
      this.store.append("reconciliation", result.id, 1, result);
      return result;
    });
  }
  propose(value: ResolutionRequest, context: CommandContext) {
    const request = resolutionRequestSchema.parse(value);
    return this.commands.executeSync("resolution.propose", request, context, () => {
      const run = this.run(request.runId);
      if (!run.breaks.some((b) => b.id === request.breakId))
        throw new ApplicationError("NOT_FOUND", "Break does not belong to reconciliation.");
      if (request.correction && request.correction.portfolioId !== run.portfolioId)
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "Correction portfolio differs from the break.",
        );
      const result = resolutionSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: this.clock.now(),
        approvedAt: null,
        request,
        portfolioId: run.portfolioId,
        status: "proposed",
        journalEventIds: [],
      });
      this.store.append("resolution", result.id, 1, result);
      return result;
    });
  }
  approve(id: string, expectedRevision: number, context: CommandContext) {
    return this.commands.executeSync(
      "resolution.approve",
      { id, expectedRevision },
      context,
      () => {
        const raw = this.store.get("resolution", id);
        if (!raw) throw new ApplicationError("NOT_FOUND", "Resolution not found.");
        const resolution = resolutionSchema.parse(raw);
        if (resolution.revision !== expectedRevision || resolution.status !== "proposed")
          throw new ApplicationError(
            "REVISION_CONFLICT",
            "Resolution changed or is already approved.",
          );
        const run = this.run(resolution.request.runId),
          correction = resolution.request.correction;
        if (correction) {
          const before = this.ledger.get(run.portfolioId);
          if (before.book.checkpoint !== run.book.book.checkpoint)
            throw new ApplicationError(
              "REVISION_CONFLICT",
              "Book changed; reconcile again before correcting.",
            );
          if (
            this.store
              .all("paper-batch")
              .map((v) => paperBatchSchema.parse(v))
              .some((b) => b.portfolioId === run.portfolioId && b.status === "active")
          )
            throw new ApplicationError(
              "INVALID_EVENT",
              "Complete or cancel active orders before correcting operations.",
            );
          const original = before.events.find((e) => e.id === correction.originalEventId),
            allowed = ["deposit", "withdrawal", "fee", "settlement", "settlement_failure"];
          if (
            !original ||
            !allowed.includes(original.input.kind) ||
            (correction.replacement && correction.replacement.kind !== original.input.kind)
          )
            throw new ApplicationError(
              "INVALID_EVENT",
              "This correction workflow supports the latest cash or settlement event with the same replacement kind.",
            );
          const after = this.ledger.correctWithinTransaction(correction);
          resolution.journalEventIds = after.events.slice(before.events.length).map((e) => e.id);
          resolution.status = "corrected_requires_reconciliation";
        } else resolution.status = "approved_followup";
        resolution.revision++;
        resolution.approvedAt = this.clock.now();
        this.store.append("resolution", id, resolution.revision, resolution);
        return resolution;
      },
    );
  }
}
