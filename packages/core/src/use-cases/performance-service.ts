import {
  performanceRequestSchema,
  performanceSnapshotSchema,
  type PerformanceRequest,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { ValuationService } from "./valuation-service.js";
import type { LedgerService } from "./ledger-service.js";
import type { BenchmarkService } from "./benchmark-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { calculatePerformance } from "../domain/performance/calculate-performance.js";
export class PerformanceService {
  constructor(
    private store: SnapshotRepository,
    private valuations: ValuationService,
    private ledger: LedgerService,
    private benchmarks: BenchmarkService,
    private clock: Clock,
    private ids: IdFactory,
    private commands: Commands,
  ) {}
  list() {
    return this.store.all("performance").map((v) => performanceSnapshotSchema.parse(v));
  }
  get(id: string) {
    const v = this.store.get("performance", id, 1);
    if (!v) throw new ApplicationError("NOT_FOUND", "Performance snapshot not found.");
    return performanceSnapshotSchema.parse(v);
  }
  create(value: PerformanceRequest, context: CommandContext) {
    const request = performanceRequestSchema.parse(value);
    return this.commands.executeSync("performance.create", request, context, () => {
      const valuations = request.valuations.map((ref) => {
          const v = this.valuations.get(ref.id);
          if (v.revision !== ref.revision)
            throw new ApplicationError("INVALID_SNAPSHOT", "Valuation revision does not exist.");
          return v;
        }),
        first = valuations[0]!,
        last = valuations.at(-1)!,
        now = this.clock.now();
      for (const [i, v] of valuations.entries()) {
        const previous = valuations[i - 1];
        if (
          v.request.portfolioId !== first.request.portfolioId ||
          v.baseCurrency !== first.baseCurrency ||
          Date.parse(v.createdAt) > Date.parse(now) ||
          (previous &&
            (Date.parse(v.request.asOf) < Date.parse(previous.request.asOf) ||
              v.book.checkpoint < previous.book.checkpoint ||
              (Date.parse(v.request.asOf) === Date.parse(previous.request.asOf) &&
                v.book.checkpoint === previous.book.checkpoint)))
        )
          throw new ApplicationError(
            "INVALID_SNAPSHOT",
            "Use one portfolio/currency with advancing time or checkpoint, chronological evidence and no future sources.",
          );
      }
      const events = this.ledger
        .atCheckpoint(first.request.portfolioId, last.book.checkpoint, last.request.asOf)
        .events.filter((e) => e.sequence > first.book.checkpoint);
      const benchmark = request.benchmark ? this.benchmarks.get(request.benchmark.id) : null;
      if (request.benchmark && request.benchmark.revision !== 1)
        throw new ApplicationError("INVALID_SNAPSHOT", "Benchmark revision does not exist.");
      const result = performanceSnapshotSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: now,
        portfolioId: first.request.portfolioId,
        currency: first.baseCurrency,
        request,
        valuations,
        events,
        benchmark,
        ...calculatePerformance(valuations, events, benchmark),
        policyVersion: "chapter-15.v1",
        feeBasis: "net_of_recorded_book_costs",
        incomeBasis: "received_cash_income_no_tax_model",
      });
      this.store.append("performance", result.id, 1, result);
      return result;
    });
  }
}
