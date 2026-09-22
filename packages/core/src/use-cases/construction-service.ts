import {
  constructionRequestSchema,
  targetSnapshotSchema,
  type ConstructionRequest,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { ConstructionEngine } from "../ports/construction-engine.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { PortfolioService } from "./portfolio-service.js";
import type { RiskService } from "./risk-service.js";
import type { ValuationService } from "./valuation-service.js";
import type { MarketDataService } from "./market-data-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { constructTarget } from "../domain/construction/construct-target.js";
export class ConstructionService {
  constructor(
    private readonly store: SnapshotRepository,
    private readonly engine: ConstructionEngine,
    private readonly portfolios: PortfolioService,
    private readonly risks: RiskService,
    private readonly valuations: ValuationService,
    private readonly datasets: MarketDataService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
  ) {}
  list() {
    return this.store.all("target").map((v) => targetSnapshotSchema.parse(v));
  }
  get(id: string) {
    const value = this.store.get("target", id, 1);
    if (!value) throw new ApplicationError("NOT_FOUND", "Target snapshot not found.");
    return targetSnapshotSchema.parse(value);
  }
  create(value: ConstructionRequest, context: CommandContext) {
    const request = constructionRequestSchema.parse(value);
    return this.commands.executeSync("target.create", request, context, () => {
      const portfolio = this.portfolios.getPortfolio(request.portfolioId),
        mandate = this.portfolios.getMandate(portfolio.mandateId);
      if (mandate.revision !== request.mandateRevision)
        throw new ApplicationError(
          "REVISION_CONFLICT",
          "Mandate changed; select its current revision.",
        );
      const model = this.risks.get(request.riskModel.id),
        valuation = this.valuations.get(request.valuation.id);
      if (
        model.revision !== request.riskModel.revision ||
        valuation.revision !== request.valuation.revision
      )
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "Risk-model or valuation revision does not exist.",
        );
      const now = this.clock.now();
      if (
        [model.createdAt, valuation.createdAt, mandate.updatedAt].some(
          (time) => Date.parse(time) > Date.parse(now),
        )
      )
        throw new ApplicationError("INVALID_SNAPSHOT", "Input evidence cannot be from the future.");
      const instruments = model.assets.map(
        (a) => this.datasets.get(a.dataset.id, a.dataset.revision).instrument,
      );
      const result = targetSnapshotSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: now,
        ...constructTarget(request, mandate, model, valuation, instruments, this.engine, now),
      });
      this.store.append("target", result.id, 1, result);
      return result;
    });
  }
}
