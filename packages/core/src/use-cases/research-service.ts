import {
  researchRequestSchema,
  researchResultSchema,
  type ResearchRequest,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { ResearchEngine } from "../ports/research-engine.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { MarketDataService } from "./market-data-service.js";
import type { AdjustmentService } from "./adjustment-service.js";
import type { CompanyService } from "./company-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
export class ResearchService {
  constructor(
    private readonly store: SnapshotRepository,
    private readonly engine: ResearchEngine,
    private readonly datasets: MarketDataService,
    private readonly adjustments: AdjustmentService,
    private readonly companies: CompanyService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
  ) {}
  list() {
    return this.store.all("research").map((v) => researchResultSchema.parse(v));
  }
  get(id: string) {
    const value = this.store.get("research", id, 1);
    if (!value) throw new ApplicationError("NOT_FOUND", "Research run not found.");
    return researchResultSchema.parse(value);
  }
  create(value: ResearchRequest, context: CommandContext) {
    const request = researchRequestSchema.parse(value);
    return this.commands.executeSync("research.create", request, context, () => {
      if (Date.parse(request.asOf) > Date.parse(this.clock.now()))
        throw new ApplicationError("INVALID_SNAPSHOT", "Research cutoff cannot be in the future.");
      const sources = request.series.map((ref) => ({
        dataset: this.datasets.get(ref.dataset.id, ref.dataset.revision),
        run: ref.adjustmentRun
          ? this.adjustments.get(ref.adjustmentRun.id, ref.adjustmentRun.revision)
          : null,
      }));
      const companies = request.companies.map((ref) => this.companies.get(ref.id, ref.revision));
      const ids = sources.map((s) => s.dataset.instrument.instrumentId);
      if (
        new Set(ids).size !== ids.length ||
        new Set(companies.map((c) => c.instrument.instrumentId)).size !== companies.length ||
        companies.some((c) => !ids.includes(c.instrument.instrumentId))
      )
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "Select exactly one dataset and at most one company observation for each instrument.",
        );
      const result = researchResultSchema.parse({
        id: this.ids.next(),
        createdAt: this.clock.now(),
        request,
        ...this.engine.calculate(request, sources, companies),
      });
      this.store.append("research", result.id, 1, result);
      return result;
    });
  }
}
