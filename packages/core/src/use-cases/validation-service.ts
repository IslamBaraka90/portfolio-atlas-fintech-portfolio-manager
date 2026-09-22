import {
  validationRequestSchema,
  validationRunSchema,
  type ValidationRequest,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { HistoricalFixtureProvider, DrawdownEngine } from "../ports/validation.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { MarketDataService } from "./market-data-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { validateStrategy } from "../domain/validation/validate-strategy.js";
export class ValidationService {
  constructor(
    private store: SnapshotRepository,
    private fixtures: HistoricalFixtureProvider,
    private engine: DrawdownEngine,
    private datasets: MarketDataService,
    private clock: Clock,
    private ids: IdFactory,
    private commands: Commands,
  ) {}
  list() {
    return this.store.all("validation").map((v) => validationRunSchema.parse(v));
  }
  get(id: string) {
    const value = this.store.get("validation", id, 1);
    if (!value) throw new ApplicationError("NOT_FOUND", "Validation run not found.");
    return validationRunSchema.parse(value);
  }
  create(value: ValidationRequest, context: CommandContext) {
    const request = validationRequestSchema.parse(value);
    return this.commands.executeSync("validation.create", request, context, () => {
      if (request.dataset) this.datasets.get(request.dataset.id, request.dataset.revision);
      const result = validationRunSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: this.clock.now(),
        ...validateStrategy(this.fixtures.get(request.scenario), request, this.engine),
      });
      this.store.append("validation", result.id, 1, result);
      return result;
    });
  }
}
