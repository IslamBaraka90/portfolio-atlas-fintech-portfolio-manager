import {
  rebalanceRequestSchema,
  rebalanceProposalSchema,
  type RebalanceRequest,
  type RebalanceProposal,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { LotScoringEngine } from "../ports/lot-scoring.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { ConstructionService } from "./construction-service.js";
import type { ValuationService } from "./valuation-service.js";
import type { LedgerService } from "./ledger-service.js";
import type { PortfolioService } from "./portfolio-service.js";
import type { InstrumentService } from "./instrument-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { planRebalance } from "../domain/rebalancing/plan-rebalance.js";
export class RebalanceService {
  constructor(
    private store: SnapshotRepository,
    private targets: ConstructionService,
    private valuations: ValuationService,
    private ledger: LedgerService,
    private portfolios: PortfolioService,
    private instruments: InstrumentService,
    private lots: LotScoringEngine,
    private clock: Clock,
    private ids: IdFactory,
    private commands: Commands,
  ) {}
  list() {
    return this.store.all("rebalance").map((v) => rebalanceProposalSchema.parse(v));
  }
  get(id: string, revision?: number) {
    const value = this.store.get("rebalance", id, revision);
    if (!value) throw new ApplicationError("NOT_FOUND", "Rebalance proposal not found.");
    return rebalanceProposalSchema.parse(value);
  }
  assertFresh(proposal: Pick<RebalanceProposal, "target" | "valuation" | "expiresAt" | "request">) {
    const { target, valuation } = proposal,
      now = Date.parse(this.clock.now());
    const portfolio = this.portfolios.getPortfolio(target.request.portfolioId),
      mandate = this.portfolios.getMandate(portfolio.mandateId),
      book = this.ledger.get(portfolio.id);
    const latest = this.valuations
      .list()
      .filter((v) => v.request.portfolioId === portfolio.id)
      .at(-1);
    if (
      now >= Date.parse(proposal.expiresAt) ||
      Date.parse(target.createdAt) > now ||
      now - Date.parse(target.createdAt) > 86400000 ||
      Date.parse(valuation.request.asOf) > now ||
      now - Date.parse(valuation.request.asOf) > 3600000 ||
      [
        ...valuation.positions.map((p) => p.mark.quotedAt),
        ...proposal.request.newPrices.map((p) => p.quotedAt),
      ].some((at) => !at || Date.parse(at) > now || now - Date.parse(at) > 3600000)
    )
      throw new ApplicationError(
        "INVALID_SNAPSHOT",
        "Proposal, target or valuation has expired; rebuild from fresh evidence.",
      );
    if (
      mandate.id !== target.mandate.id ||
      mandate.revision !== target.mandate.revision ||
      book.book.checkpoint !== valuation.book.checkpoint ||
      latest?.id !== valuation.id ||
      target.instruments.some((i) => this.instruments.get(i.instrumentId).revision !== i.revision)
    )
      throw new ApplicationError(
        "REVISION_CONFLICT",
        "Book, price valuation, mandate or instrument revision changed; rebuild the proposal.",
      );
    if (book.book.settlements.some((o) => o.status !== "settled"))
      throw new ApplicationError(
        "INVALID_SNAPSHOT",
        "Settle deferred obligations before a new rebalance.",
      );
    if (!book.book.reconciled)
      throw new ApplicationError("BOOK_INVARIANT", "Book must reconcile before approval.");
    return book;
  }
  create(value: RebalanceRequest, context: CommandContext) {
    const request = rebalanceRequestSchema.parse(value);
    return this.commands.executeSync("rebalance.create", request, context, () => {
      const target = this.targets.get(request.target.id),
        valuation = this.valuations.get(request.valuation.id),
        now = this.clock.now(),
        expiresAt = new Date(Date.parse(now) + 900000).toISOString();
      if (
        target.revision !== request.target.revision ||
        valuation.revision !== request.valuation.revision
      )
        throw new ApplicationError("INVALID_SNAPSHOT", "Referenced revision does not exist.");
      const source = this.assertFresh({ target, valuation, expiresAt, request });
      const result = rebalanceProposalSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: now,
        expiresAt,
        approvedAt: null,
        ...planRebalance(request, target, valuation, source, now, this.lots),
      });
      this.store.append("rebalance", result.id, 1, result);
      return result;
    });
  }
  approve(id: string, expectedRevision: number, context: CommandContext) {
    return this.commands.executeSync("rebalance.approve", { id, expectedRevision }, context, () => {
      const proposal = this.get(id);
      if (proposal.revision !== expectedRevision)
        throw new ApplicationError("REVISION_CONFLICT", "Proposal revision changed.");
      if (proposal.status !== "ready")
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "Only a ready trade proposal can be approved.",
        );
      this.assertFresh(proposal);
      const result = rebalanceProposalSchema.parse({
        ...proposal,
        revision: proposal.revision + 1,
        status: "approved",
        approvedAt: this.clock.now(),
      });
      this.store.append("rebalance", id, result.revision, result);
      return result;
    });
  }
}
