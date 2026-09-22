import { adjustmentResultSchema, type AdjustmentRequest } from "@portfolio-atlas/contracts";
import type { ActionRepository, AdjustmentEngine } from "../ports/corporate-actions.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { CorporateActionService } from "./corporate-action-service.js";
import type { MarketDataService } from "./market-data-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
export class AdjustmentService {
  constructor(
    private readonly repository: ActionRepository,
    private readonly engine: AdjustmentEngine,
    private readonly actions: CorporateActionService,
    private readonly datasets: MarketDataService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
  ) {}
  list() {
    return this.repository.runs();
  }
  get(id: string, revision?: number) {
    const run = this.repository.run(id, revision);
    if (!run) throw new ApplicationError("NOT_FOUND", "Adjustment run not found.");
    return run;
  }
  run(input: AdjustmentRequest, context: CommandContext) {
    return this.commands.executeSync("adjustment.run", input, context, () => {
      const review = this.actions.get(input.reviewId),
        dataset = this.datasets.get(review.datasetId, review.datasetRevision),
        now = this.clock.now();
      if (Date.parse(input.actionKnowledgeAt) > Date.parse(now))
        throw new ApplicationError(
          "REVISION_CONFLICT",
          "Action cutoff cannot be later than the calculation time.",
        );
      if (review.sourceHash !== dataset.sourceHash)
        throw new ApplicationError(
          "REVISION_CONFLICT",
          "Review does not match its source dataset.",
        );
      const result = this.engine.calculate(dataset, review, input, now);
      const previous = this.repository.runs().find((row) => row.datasetId === dataset.id);
      const run = adjustmentResultSchema.parse({
        id: previous?.id ?? this.ids.next(),
        revision: (previous?.revision ?? 0) + 1,
        createdAt: now,
        datasetId: dataset.id,
        datasetRevision: dataset.revision,
        sourceHash: dataset.sourceHash,
        reviewId: review.id,
        actionKnowledgeAt: input.actionKnowledgeAt,
        priceObservedAt: dataset.observedAt,
        method: "chapter-4.v1_current-price-research",
        sourceCurrency: dataset.quoteUnit.currency,
        targetCurrency: input.targetCurrency,
        dividendTreatment: "embedded_in_total_return_do_not_add_cash_again",
        ...result,
      });
      this.repository.saveRun(run);
      return run;
    });
  }
}
