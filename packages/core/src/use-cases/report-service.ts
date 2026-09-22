import { z } from "zod";
import {
  reportRequestSchema,
  reportEvidenceSchema,
  reportSnapshotSchema,
  reportApprovalSchema,
  valuationSnapshotSchema,
  monitorSnapshotSchema,
  performanceSnapshotSchema,
  attributionResultSchema,
  reconciliationRunSchema,
  targetSnapshotSchema,
  paperBatchSchema,
  researchResultSchema,
  marketDatasetSchema,
  type ReportRequest,
  type ReportApproval,
  type SnapshotRef,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { PortfolioService } from "./portfolio-service.js";
import type { LedgerService } from "./ledger-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { assembleReport } from "../domain/reporting/assemble-report.js";
export class ReportService {
  constructor(
    private store: SnapshotRepository,
    private portfolios: PortfolioService,
    private ledger: LedgerService,
    private clock: Clock,
    private ids: IdFactory,
    private commands: Commands,
  ) {}
  list() {
    return this.store.all("report").map((v) => reportSnapshotSchema.parse(v));
  }
  get(id: string, revision?: number) {
    const v = this.store.get("report", id, revision);
    if (!v) throw new ApplicationError("NOT_FOUND", "Report revision not found.");
    return reportSnapshotSchema.parse(v);
  }
  history(id: string) {
    const latest = this.get(id);
    return Array.from({ length: latest.revision }, (_, i) => this.get(id, i + 1));
  }
  compare(id: string, from: number, to: number) {
    const a = this.get(id, from),
      b = this.get(id, to);
    return {
      from: { id, revision: a.revision },
      to: { id, revision: b.revision },
      navFrom: a.navTie.nav,
      navTo: b.navTie.nav,
      coverageFrom: a.coverage,
      coverageTo: b.coverage,
      sourcesFrom: a.sections.flatMap((s) => s.sources),
      sourcesTo: b.sections.flatMap((s) => s.sources),
    };
  }
  create(value: ReportRequest, context: CommandContext) {
    const request = reportRequestSchema.parse(value);
    return this.commands.executeSync("report.create", request, context, () => {
      const now = this.clock.now(),
        portfolio = this.portfolios.getPortfolio(request.portfolioId),
        cutoff = Date.parse(request.dataCutoff);
      const invalid = (message: string): never => {
        throw new ApplicationError("INVALID_SNAPSHOT", message);
      };
      if (cutoff > Date.parse(now) || Date.parse(portfolio.createdAt) > cutoff)
        invalid("Report evidence cutoff cannot be future or precede portfolio creation.");
      const read = <T>(kind: string, ref: SnapshotRef | null, schema: z.ZodType<T>): T | null => {
        if (!ref) return null;
        const raw = this.store.get(kind, ref.id, ref.revision);
        if (!raw) throw new ApplicationError("NOT_FOUND", kind + " revision not found.");
        return schema.parse(raw);
      };
      const evidence = reportEvidenceSchema.parse({
        valuation: read("valuation", request.valuation, valuationSnapshotSchema),
        monitor: read("monitor", request.monitor, monitorSnapshotSchema),
        performance: read("performance", request.performance, performanceSnapshotSchema),
        attribution: read("attribution", request.attribution, attributionResultSchema),
        reconciliation: read("reconciliation", request.reconciliation, reconciliationRunSchema),
        target: read("target", request.target, targetSnapshotSchema),
        batches: request.batches.map((r) => read("paper-batch", r, paperBatchSchema)!),
        research: request.research.map((r) => read("research", r, researchResultSchema)!),
        datasets: request.datasets.map((r) => read("dataset", r, marketDatasetSchema)!),
      });
      for (const item of [
        evidence.valuation,
        evidence.monitor,
        evidence.performance,
        evidence.attribution,
        evidence.reconciliation,
        evidence.target,
        ...evidence.batches,
        ...evidence.research,
        ...evidence.datasets,
      ]) {
        if (
          item &&
          (Date.parse(item.createdAt) > cutoff ||
            ("updatedAt" in item && Date.parse(item.updatedAt) > cutoff))
        )
          invalid("Selected source was recorded after the data cutoff.");
      }
      const v = evidence.valuation;
      if (
        v &&
        (v.request.portfolioId !== portfolio.id ||
          v.baseCurrency !== portfolio.baseCurrency ||
          Date.parse(v.request.asOf) !== Date.parse(request.asOf))
      )
        invalid("Valuation portfolio, currency or as-of differs from report scope.");
      if (
        !v &&
        (evidence.monitor ||
          evidence.performance ||
          evidence.reconciliation ||
          evidence.batches.length)
      )
        invalid("A valuation is required to align risk, performance, operations and orders.");
      if (
        evidence.monitor &&
        (evidence.monitor.portfolioId !== portfolio.id || evidence.monitor.valuation.id !== v!.id)
      )
        invalid("Monitor must reference the selected portfolio valuation.");
      if (
        evidence.performance &&
        (evidence.performance.portfolioId !== portfolio.id ||
          evidence.performance.valuations.at(-1)!.id !== v!.id)
      )
        invalid("Performance must end at the selected portfolio valuation.");
      if (
        evidence.attribution &&
        (!evidence.performance ||
          evidence.attribution.linkage !== "compatible" ||
          !evidence.attribution.reconciled ||
          evidence.attribution.request.performance?.id !== evidence.performance.id)
      )
        invalid(
          "Report attribution must reconcile and link compatibly to the selected performance.",
        );
      if (
        evidence.reconciliation &&
        (evidence.reconciliation.portfolioId !== portfolio.id ||
          evidence.reconciliation.book.book.checkpoint !== v!.book.checkpoint ||
          Date.parse(evidence.reconciliation.statement.asOf) !== Date.parse(request.asOf))
      )
        invalid("Reconciliation must share the valuation's portfolio, checkpoint and cutoff.");
      if (
        evidence.target &&
        (evidence.target.request.portfolioId !== portfolio.id ||
          evidence.target.currency !== portfolio.baseCurrency)
      )
        invalid("Target scope differs from the portfolio.");
      const events = v
        ? this.ledger.atCheckpoint(portfolio.id, v.book.checkpoint, v.request.asOf).events
        : [];
      for (const batch of evidence.batches)
        if (
          batch.portfolioId !== portfolio.id ||
          batch.expectedBookCheckpoint > v!.book.checkpoint ||
          batch.orders.some((o) =>
            o.fills.some(
              (f) =>
                Date.parse(f.at) > Date.parse(request.asOf) ||
                !events.some((e) => e.id === f.ledgerEventId),
            ),
          )
        )
          invalid("Selected batch has another portfolio or fills beyond the frozen book.");
      const universe = new Set([
        ...(v?.positions.map((p) => p.instrumentId) ?? []),
        ...(evidence.target?.assetIds ?? []),
        ...evidence.batches.flatMap((b) => b.orders.map((o) => o.instrumentId)),
      ]);
      for (const d of evidence.datasets)
        if (!universe.has(d.instrument.instrumentId))
          invalid("Dataset is outside the report's holdings/target/order universe.");
      for (const r of evidence.research)
        if (
          Date.parse(r.request.asOf) > Date.parse(request.asOf) ||
          [...r.trends, ...r.fundamentals].some((t) => !universe.has(t.instrumentId))
        )
          invalid("Research time or instrument scope exceeds report context.");
      const previous = request.supersedes ? this.get(request.supersedes.id) : null;
      if (
        previous &&
        (previous.revision !== request.supersedes!.revision ||
          previous.portfolio.id !== portfolio.id)
      )
        invalid("Supersession requires the latest revision of this portfolio's report.");
      const id = previous?.id ?? this.ids.next(),
        revision = (previous?.revision ?? 0) + 1;
      const result = reportSnapshotSchema.parse({
        id,
        revision,
        createdAt: now,
        portfolio,
        request,
        currency: portfolio.baseCurrency,
        evidence,
        ...assembleReport(id, request, evidence, portfolio),
        status: "draft",
        approval: null,
        supersedes: request.supersedes,
        policyVersion: "chapter-16.v1",
        packageVersion: "0.13.2",
      });
      this.store.append("report", id, revision, result);
      return result;
    });
  }
  approve(id: string, value: ReportApproval, context: CommandContext) {
    const input = reportApprovalSchema.parse(value);
    return this.commands.executeSync("report.approve", { id, ...input }, context, () => {
      const report = this.get(id);
      if (report.revision !== input.expectedRevision || report.status !== "draft")
        throw new ApplicationError("REVISION_CONFLICT", "Report changed or is already approved.");
      if ((report.coverage.missing || report.coverage.exceptions) && !input.acknowledgeExceptions)
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "Explicitly acknowledge missing sections and exceptions before approval.",
        );
      report.revision++;
      report.createdAt = this.clock.now();
      report.status = "approved";
      report.approval = {
        actor: input.actor,
        reason: input.reason,
        at: this.clock.now(),
        acknowledgedExceptions: input.acknowledgeExceptions,
      };
      this.store.append("report", id, report.revision, report);
      return report;
    });
  }
}
