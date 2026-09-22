import { actionReviewSchema, type ActionReview } from "@portfolio-atlas/contracts";
import type { ActionNormalizer, ActionRepository } from "../ports/corporate-actions.js";
import type { RawArchive } from "../ports/market-data.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { MarketDataService } from "./market-data-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
export class CorporateActionService {
  constructor(
    private readonly repository: ActionRepository,
    private readonly archive: RawArchive,
    private readonly normalizer: ActionNormalizer,
    private readonly datasets: MarketDataService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
  ) {}
  list() {
    return this.repository.reviews();
  }
  get(id: string) {
    const review = this.repository.review(id);
    if (!review) throw new ApplicationError("NOT_FOUND", "Action review not found.");
    return review;
  }
  review(
    input: { datasetId: string; datasetRevision: number },
    context: CommandContext,
  ): Promise<ActionReview> {
    return this.commands.executePrepared("corporate-actions.review", input, context, async () => {
      const dataset = this.datasets.get(input.datasetId, input.datasetRevision);
      const raw = await this.archive.read(dataset.sourceHash);
      const normalized = this.normalizer.normalize(dataset, raw);
      return () => {
        const review = actionReviewSchema.parse({
          id: this.ids.next(),
          createdAt: this.clock.now(),
          datasetId: dataset.id,
          datasetRevision: dataset.revision,
          sourceHash: dataset.sourceHash,
          ...normalized,
        });
        this.repository.saveReview(review);
        return review;
      };
    });
  }
}
