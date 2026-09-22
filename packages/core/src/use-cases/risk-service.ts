import {
  riskModelRequestSchema,
  riskModelSnapshotSchema,
  type RiskModelRequest,
} from "@portfolio-atlas/contracts";
import type { RiskEngine } from "../ports/risk-engine.js";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { AdjustmentService } from "./adjustment-service.js";
import type { MarketDataService } from "./market-data-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
export class RiskService {
  constructor(
    private readonly store: SnapshotRepository,
    private readonly engine: RiskEngine,
    private readonly adjustments: AdjustmentService,
    private readonly datasets: MarketDataService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
  ) {}
  list() {
    return this.store.all("risk-model").map((v) => riskModelSnapshotSchema.parse(v));
  }
  get(id: string) {
    const value = this.store.get("risk-model", id, 1);
    if (!value) throw new ApplicationError("NOT_FOUND", "Risk model not found.");
    return riskModelSnapshotSchema.parse(value);
  }
  create(value: RiskModelRequest, context: CommandContext) {
    const request = riskModelRequestSchema.parse(value);
    return this.commands.executeSync("risk-model.create", request, context, () => {
      if (Date.parse(request.asOf) > Date.parse(this.clock.now()))
        throw new ApplicationError("INVALID_SNAPSHOT", "Risk cutoff cannot be in the future.");
      const sources = request.adjustmentRuns.map((ref) => {
        const run = this.adjustments.get(ref.id, ref.revision);
        return { run, dataset: this.datasets.get(run.datasetId, run.datasetRevision) };
      });
      const result = riskModelSnapshotSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: this.clock.now(),
        request,
        ...this.engine.calculate(request, sources),
      });
      this.store.append("risk-model", result.id, 1, result);
      return result;
    });
  }
}
