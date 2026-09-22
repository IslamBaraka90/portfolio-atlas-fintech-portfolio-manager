import {
  monitorRequestSchema,
  monitorSnapshotSchema,
  riskFindingSchema,
  findingActionSchema,
  type MonitorRequest,
  type FindingAction,
  type RiskFinding,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { MonitorAnalytics } from "../ports/monitor-analytics.js";
import type { ValuationService } from "./valuation-service.js";
import type { RiskService } from "./risk-service.js";
import type { ConstructionService } from "./construction-service.js";
import type { PortfolioService } from "./portfolio-service.js";
import type { InstrumentService } from "./instrument-service.js";
import type { LedgerService } from "./ledger-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { monitorPortfolio, monitorFreshness } from "../domain/risk-monitoring/monitor-portfolio.js";
export class MonitorService {
  constructor(
    private store: SnapshotRepository,
    private valuations: ValuationService,
    private risks: RiskService,
    private targets: ConstructionService,
    private portfolios: PortfolioService,
    private instruments: InstrumentService,
    private ledger: LedgerService,
    private analytics: MonitorAnalytics,
    private clock: Clock,
    private ids: IdFactory,
    private commands: Commands,
  ) {}
  list() {
    return this.store.all("monitor").map((v) => monitorSnapshotSchema.parse(v));
  }
  get(id: string) {
    const v = this.store.get("monitor", id, 1);
    if (!v) throw new ApplicationError("NOT_FOUND", "Monitor snapshot not found.");
    return monitorSnapshotSchema.parse(v);
  }
  findings() {
    return this.store.all("risk-finding").map((v) => riskFindingSchema.parse(v));
  }
  create(value: MonitorRequest, context: CommandContext) {
    const request = monitorRequestSchema.parse(value);
    return this.commands.executeSync("monitor.create", request, context, () => {
      const valuation = this.valuations.get(request.valuation.id),
        risk = request.riskModel ? this.risks.get(request.riskModel.id) : null,
        target = request.target ? this.targets.get(request.target.id) : null;
      const portfolio = this.portfolios.getPortfolio(valuation.request.portfolioId),
        mandate = this.portfolios.getMandate(portfolio.mandateId),
        now = this.clock.now();
      if (
        request.valuation.revision !== valuation.revision ||
        (risk && request.riskModel?.revision !== risk.revision) ||
        (target && request.target?.revision !== target.revision)
      )
        throw new ApplicationError("INVALID_SNAPSHOT", "Selected revision does not exist.");
      if (
        target &&
        (target.request.portfolioId !== portfolio.id ||
          target.mandate.revision !== mandate.revision)
      )
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "Target belongs to another portfolio or mandate revision.",
        );
      if (
        [valuation.createdAt, risk?.createdAt, target?.createdAt].some(
          (d) => d && Date.parse(d) > Date.parse(now),
        )
      )
        throw new ApplicationError("INVALID_SNAPSHOT", "Future evidence is unavailable.");
      if (
        this.valuations
          .list()
          .filter((v) => v.request.portfolioId === portfolio.id)
          .at(-1)?.id !== valuation.id
      )
        throw new ApplicationError(
          "INVALID_SNAPSHOT",
          "A newer valuation exists; monitor the latest portfolio valuation.",
        );
      const instruments = this.instruments.list(),
        checkpoint = this.ledger.get(portfolio.id).book.checkpoint;
      const run = monitorSnapshotSchema.parse({
        id: this.ids.next(),
        revision: 1,
        createdAt: now,
        portfolioId: portfolio.id,
        request,
        valuation,
        mandate,
        instruments,
        target,
        riskModel: risk,
        ...monitorPortfolio(
          request,
          valuation,
          mandate,
          instruments,
          risk,
          target,
          checkpoint,
          now,
          this.analytics,
        ),
        policyVersion: "chapter-14.v1",
        packageVersion: "0.13.2",
      });
      this.store.append("monitor", run.id, 1, run);
      for (const observation of run.observations) {
        const old = this.findings().find((f) => f.key === observation.key);
        if (!old && observation.status === "pass") continue;
        const status =
          old?.status === "resolved" && observation.status !== "pass"
            ? "open"
            : (old?.status ?? "open");
        const finding = riskFindingSchema.parse({
          id: old?.id ?? this.ids.next(),
          revision: (old?.revision ?? 0) + 1,
          key: observation.key,
          portfolioId: portfolio.id,
          rule: observation.rule,
          subject: observation.subject,
          mandateRevision: mandate.revision,
          severity: observation.severity,
          status,
          firstSeen: old?.firstSeen ?? now,
          lastSeen: now,
          lastRunId: run.id,
          observation,
          history: [
            ...(old?.history ?? []),
            {
              at: now,
              action: status !== old?.status ? "observe_" + status : "observe",
              actor: "monitor",
              reason: observation.reason,
              runId: run.id,
            },
          ],
        });
        this.store.append("risk-finding", finding.id, finding.revision, finding);
      }
      return run;
    });
  }
  act(id: string, value: FindingAction, context: CommandContext) {
    const input = findingActionSchema.parse(value);
    return this.commands.executeSync("risk-finding.action", { id, ...input }, context, () => {
      const raw = this.store.get("risk-finding", id);
      if (!raw) throw new ApplicationError("NOT_FOUND", "Finding not found.");
      const f = riskFindingSchema.parse(raw);
      if (f.revision !== input.expectedRevision || f.status === "resolved")
        throw new ApplicationError("REVISION_CONFLICT", "Finding changed or is already resolved.");
      if (input.action === "resolve") {
        const run = this.get(f.lastRunId),
          latest = this.list()
            .filter((r) => r.portfolioId === f.portfolioId)
            .at(-1),
          portfolio = this.portfolios.getPortfolio(f.portfolioId);
        if (
          f.observation.status !== "pass" ||
          !run.fresh ||
          latest?.id !== run.id ||
          this.valuations
            .list()
            .filter((v) => v.request.portfolioId === f.portfolioId)
            .at(-1)?.id !== run.valuation.id ||
          this.portfolios.getMandate(portfolio.mandateId).revision !== f.mandateRevision ||
          monitorFreshness(
            run.valuation,
            this.ledger.get(f.portfolioId).book.checkpoint,
            this.clock.now(),
          ).length
        )
          throw new ApplicationError(
            "INVALID_SNAPSHOT",
            "Resolve needs a fresh passing observation from the latest run and unchanged book/mandate.",
          );
      }
      const status: RiskFinding["status"] =
        input.action === "resolve"
          ? "resolved"
          : input.action === "escalate"
            ? "escalated"
            : "acknowledged";
      f.revision++;
      f.status = status;
      f.history.push({
        at: this.clock.now(),
        action: input.action,
        actor: input.actor,
        reason: input.reason,
        runId: f.lastRunId,
      });
      this.store.append("risk-finding", id, f.revision, f);
      return f;
    });
  }
}
