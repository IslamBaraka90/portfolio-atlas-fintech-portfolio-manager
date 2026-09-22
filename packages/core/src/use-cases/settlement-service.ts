import {
  settlementPolicyInputSchema,
  settlementPolicySchema,
  settlementCommandSchema,
  paperBatchSchema,
  type SettlementPolicyInput,
  type SettlementCommand,
  type BookState,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { LedgerService } from "./ledger-service.js";
import type { PortfolioService } from "./portfolio-service.js";
import { Commands, canonical, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
export class SettlementService {
  constructor(
    private store: SnapshotRepository,
    private ledger: LedgerService,
    private portfolios: PortfolioService,
    private clock: Clock,
    private ids: IdFactory,
    private commands: Commands,
  ) {}
  policies() {
    return this.store.all("settlement-policy").map((v) => settlementPolicySchema.parse(v));
  }
  policy(id: string, revision = 1) {
    const value = this.store.get("settlement-policy", id, revision);
    if (!value) throw new ApplicationError("NOT_FOUND", "Settlement calendar revision not found.");
    return settlementPolicySchema.parse(value);
  }
  createPolicy(value: SettlementPolicyInput, context: CommandContext) {
    const input = settlementPolicyInputSchema.parse(value);
    return this.commands.executeSync("settlement.policy", input, context, () => {
      const p = settlementPolicySchema.parse({
        ...input,
        id: this.ids.next(),
        revision: 1,
        createdAt: this.clock.now(),
        source: "authored_teaching_calendar",
      });
      this.store.append("settlement-policy", p.id, 1, p);
      return p;
    });
  }
  queue() {
    return this.portfolios
      .listPortfolios()
      .map((p) => ({ portfolioId: p.id, portfolioName: p.name, book: this.ledger.get(p.id).book }));
  }
  assertManualWriteAllowed(portfolioId: string) {
    if (this.ledger.get(portfolioId).book.settlements.some((o) => o.status !== "settled"))
      throw new ApplicationError(
        "INVALID_EVENT",
        "Deferred obligations remain; use the operations workflow before manual book changes.",
      );
  }
  apply(value: SettlementCommand, context: CommandContext) {
    const request = settlementCommandSchema.parse(value);
    return this.commands.executeSync("settlement.event", request, context, () => {
      const { expectedCheckpoint, ...identity } = request,
        fingerprint = canonical(identity),
        sourceId = request.portfolioId + ":" + request.sourceRef;
      const saved = this.store.get("settlement-source", sourceId, 1) as
        { fingerprint: string; result: BookState } | undefined;
      if (saved) {
        if (saved.fingerprint !== fingerprint)
          throw new ApplicationError(
            "IDEMPOTENCY_CONFLICT",
            "Settlement source reference has different terms.",
          );
        return saved.result;
      }
      const before = this.ledger.get(request.portfolioId);
      if (before.book.checkpoint !== expectedCheckpoint)
        throw new ApplicationError(
          "REVISION_CONFLICT",
          "Book checkpoint changed before settlement.",
        );
      const obligation = before.book.settlements.find((o) => o.id === request.settlementId);
      if (!obligation) throw new ApplicationError("NOT_FOUND", "Settlement obligation not found.");
      const active = this.store
        .all("paper-batch")
        .map((v) => paperBatchSchema.parse(v))
        .find((b) => b.portfolioId === request.portfolioId && b.status === "active");
      if (
        active &&
        (active.expectedBookCheckpoint !== before.book.checkpoint ||
          !active.orders.some((o) => o.fills.some((f) => f.settlementId === request.settlementId)))
      )
        throw new ApplicationError(
          "REVISION_CONFLICT",
          "An unrelated active paper batch owns this book checkpoint.",
        );
      const result = this.ledger.postWithinTransaction({
        portfolioId: request.portfolioId,
        sourceRef: request.sourceRef,
        occurredAt: this.clock.now(),
        note: "Explicit custody acknowledgment",
        ...(request.kind === "settle"
          ? {
              kind: "settlement" as const,
              settlementId: request.settlementId,
              quantity: request.quantity!,
            }
          : {
              kind: "settlement_failure" as const,
              settlementId: request.settlementId,
              reason: request.reason,
            }),
      });
      if (active) {
        active.revision++;
        active.updatedAt = this.clock.now();
        active.expectedBookCheckpoint = result.book.checkpoint;
        const order = active.orders.find((o) =>
          o.fills.some((f) => f.settlementId === request.settlementId),
        )!;
        order.history.push({
          eventId: request.sourceRef,
          at: this.clock.now(),
          kind: "custody_" + request.kind,
          state: order.state,
          reason: "Operations updated the book and batch revision atomically.",
        });
        this.store.append(
          "paper-batch",
          active.id,
          active.revision,
          paperBatchSchema.parse(active),
        );
      }
      this.store.append("settlement-source", sourceId, 1, { fingerprint, result });
      return result;
    });
  }
}
