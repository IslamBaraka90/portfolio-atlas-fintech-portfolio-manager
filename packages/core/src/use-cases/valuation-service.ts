import {
  valuationRequestSchema,
  valuationSnapshotSchema,
  type ValuationRequest,
  type FxObservation,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { LedgerService } from "./ledger-service.js";
import type { PortfolioService } from "./portfolio-service.js";
import type { MarketDataService } from "./market-data-service.js";
import type { CorporateActionService } from "./corporate-action-service.js";
import type { AdjustmentService } from "./adjustment-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { selectMark } from "../domain/valuation/select-mark.js";
import { valueBook } from "../domain/valuation/value-book.js";
export class ValuationService {
  constructor(
    private readonly store: SnapshotRepository,
    private readonly ledger: LedgerService,
    private readonly portfolios: PortfolioService,
    private readonly datasets: MarketDataService,
    private readonly actions: CorporateActionService,
    private readonly adjustments: AdjustmentService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
  ) {}
  list() {
    return this.store.all("valuation").map((v) => valuationSnapshotSchema.parse(v));
  }
  get(id: string) {
    const value = this.store.get("valuation", id, 1);
    if (!value) throw new ApplicationError("NOT_FOUND", "Valuation snapshot not found.");
    return valuationSnapshotSchema.parse(value);
  }
  create(value: ValuationRequest, context: CommandContext) {
    const request = valuationRequestSchema.parse(value);
    return this.commands.executeSync("valuation.create", request, context, () => {
      const now = this.clock.now(),
        at = Date.parse(request.asOf);
      if (at > Date.parse(now))
        throw new ApplicationError("INVALID_SNAPSHOT", "Valuation cutoff cannot be future.");
      const book = this.ledger.atCheckpoint(request.portfolioId, request.checkpoint, request.asOf);
      if (!book.book.reconciled)
        throw new ApplicationError("BOOK_INVARIANT", "Only a reconciled book can be valued.");
      const portfolio = this.portfolios.getPortfolio(request.portfolioId);
      const held = new Set(book.book.positions.map((p) => p.instrumentId));
      if ([...request.prices, ...request.overrides].some((p) => !held.has(p.instrumentId)))
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "Price selections must reference held instruments.",
        );
      const fxEvidence: FxObservation[] = request.fxRuns.map((ref) => {
        const run = this.adjustments.get(ref.id, ref.revision);
        if (!run.fx || run.status !== "ready")
          throw new ApplicationError("INVALID_SNAPSHOT", "FX source run is unavailable.");
        return run.fx;
      });
      const pairs = fxEvidence.map((f) => [f.baseCurrency, f.quoteCurrency].sort().join("/"));
      if (new Set(pairs).size !== pairs.length)
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "Choose one FX observation per currency pair.",
        );
      const marks = book.book.positions.map((position) => {
        const choice = request.prices.find((p) => p.instrumentId === position.instrumentId);
        return selectMark(
          position,
          book,
          request,
          now,
          choice ? this.datasets.get(choice.dataset.id, choice.dataset.revision) : undefined,
          choice ? this.actions.get(choice.reviewId) : undefined,
        );
      });
      const result = valuationSnapshotSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: now,
        policyVersion: "chapter-6.v1",
        request,
        ...valueBook(book, request, portfolio.baseCurrency, marks, fxEvidence),
      });
      this.store.append("valuation", result.id, 1, result);
      return result;
    });
  }
}
