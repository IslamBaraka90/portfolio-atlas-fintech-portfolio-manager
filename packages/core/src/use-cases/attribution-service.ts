import {
  attributionRequestSchema,
  attributionResultSchema,
  type AttributionRequest,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { PerformanceService } from "./performance-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { brinsonFachler } from "../domain/attribution/brinson-fachler.js";
export class AttributionService {
  constructor(
    private store: SnapshotRepository,
    private performance: PerformanceService,
    private clock: Clock,
    private ids: IdFactory,
    private commands: Commands,
  ) {}
  list() {
    return this.store.all("attribution").map((v) => attributionResultSchema.parse(v));
  }
  get(id: string) {
    const v = this.store.get("attribution", id, 1);
    if (!v) throw new ApplicationError("NOT_FOUND", "Attribution result not found.");
    return attributionResultSchema.parse(v);
  }
  create(value: AttributionRequest, context: CommandContext) {
    const request = attributionRequestSchema.parse(value);
    return this.commands.executeSync("attribution.create", request, context, () => {
      const performance = request.performance ? this.performance.get(request.performance.id) : null;
      if (performance && request.performance?.revision !== performance.revision)
        throw new ApplicationError("INVALID_SNAPSHOT", "Performance revision does not exist.");
      if (request.to > this.clock.now().slice(0, 10))
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "Authored attribution period cannot be future.",
        );
      const result = attributionResultSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: this.clock.now(),
        request,
        ...brinsonFachler(request, performance),
        policyVersion: "chapter-15.brinson-fachler.v1",
      });
      this.store.append("attribution", result.id, 1, result);
      return result;
    });
  }
}
