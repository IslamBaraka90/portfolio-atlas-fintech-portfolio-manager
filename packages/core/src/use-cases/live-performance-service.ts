import {
  livePerformanceSchema,
  type LiveBar,
  type LiveEvent,
  type LivePerformance,
  type LiveRuntimePolicy,
  type NavPoint,
} from "@portfolio-atlas/contracts";
import { sessionState } from "../domain/live/session-calendar.js";
import type { RefreshContext, RefreshTask, RefreshTaskOutcome } from "../ports/live.js";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Transactions } from "../ports/transactions.js";
import type { LiveHistoryService } from "./live-history-service.js";
import type { LiveRiskService } from "./live-risk-service.js";
import type { LiveValuationService } from "./live-valuation-service.js";
import type { PerformanceService } from "./performance-service.js";
import type { PortfolioService } from "./portfolio-service.js";
import type { ReportService } from "./report-service.js";

export const livePerformancePolicy = "chapter-25.live-performance.v1";
const maxSessions = 30;

// The last NAV point of each exchange session date, oldest first, always ending with
// the latest point. Chapter 15 then links these valuations with external flows as
// boundaries, so a deposit never counts as return.
export function sessionCloses(points: NavPoint[], timezone: string) {
  const byDate = new Map<string, NavPoint>();
  for (const p of points)
    if (p.nav !== null) byDate.set(sessionState(timezone, p.asOf).localDate ?? p.asOf, p);
  return [...byDate.entries()].slice(-maxSessions);
}

// Benchmark price return between two session dates from final daily closes: the last
// final close on or before each date. Missing history leaves the comparison null.
export function benchmarkReturn(bars: LiveBar[], from: string, to: string) {
  const finals = bars
    .filter((b) => b.finality === "final" && b.accepted && b.close !== null && b.sessionDate)
    .sort((a, b) => a.sessionDate!.localeCompare(b.sessionDate!));
  const at = (date: string) => finals.filter((b) => b.sessionDate! <= date).at(-1)?.close ?? null;
  const start = at(from),
    end = at(to);
  return start === null || end === null || start === 0 ? null : end / start - 1;
}

// Chapter 25: once per new live valuation, measure performance with Chapter 15 and,
// after each completed session, freeze one Chapter 16 end-of-day report.
export class LivePerformanceService {
  constructor(
    private readonly policy: LiveRuntimePolicy,
    private readonly store: SnapshotRepository,
    private readonly transactions: Transactions,
    private readonly portfolios: PortfolioService,
    private readonly valuations: LiveValuationService,
    private readonly history: LiveHistoryService,
    private readonly risk: LiveRiskService,
    private readonly performance: PerformanceService,
    private readonly reports: ReportService,
    private readonly publish: (event: LiveEvent) => void,
  ) {}

  // End-of-day reports are stored separately (one per portfolio and session) and
  // attached on read, so each performance record stays immutable.
  private eod(portfolioId: string) {
    const rows = (
      this.store.prefixed
        ? this.store.prefixed("live-eod", portfolioId + "|")
        : (this.store.all("live-eod") as { portfolioId: string }[]).filter(
            (r) => r.portfolioId === portfolioId,
          )
    ) as { session: string; reportId: string }[];
    return rows.sort((a, b) => a.session.localeCompare(b.session)).at(-1) ?? null;
  }
  latest(portfolioId: string): LivePerformance | null {
    this.portfolios.getPortfolio(portfolioId);
    const rows = (
      this.store.prefixed
        ? this.store.prefixed("live-performance", portfolioId + "|")
        : (this.store.all("live-performance") as LivePerformance[]).filter(
            (r) => r.portfolioId === portfolioId,
          )
    ) as LivePerformance[];
    const record = rows.sort((a, b) => a.asOf.localeCompare(b.asOf)).at(-1);
    if (!record) return null;
    const report = this.eod(portfolioId);
    return {
      ...record,
      reportId: report?.reportId ?? null,
      reportSession: report?.session ?? null,
    };
  }

  task(): RefreshTask {
    return { name: "performance", run: (context) => this.refresh(context) };
  }

  measure(
    portfolioId: string,
    context: Pick<RefreshContext, "cycleId" | "coversSession">,
  ): LivePerformance | null {
    const latest = this.valuations.latest(portfolioId);
    if (!latest) return null;
    const id = portfolioId + "|" + latest.valuation.id;
    const existing = this.store.get("live-performance", id) as LivePerformance | undefined;
    const reportDue =
      context.coversSession !== null &&
      !(this.store.get("live-eod", portfolioId + "|" + context.coversSession) as unknown);
    if (existing && !reportDue) return null;
    const reasons: string[] = [];
    const closes = sessionCloses(
      this.valuations.navSeries(portfolioId),
      this.policy.primaryTimezone,
    );
    const sessions = closes.map(([date]) => date);
    let performanceId: string | null = existing?.performanceId ?? null,
      twr: number | null = existing?.twr ?? null,
      investmentProfit: string | null = existing?.investmentProfit ?? null;
    if (!existing) {
      if (closes.length < 2)
        reasons.push("Performance needs valued NAV points on at least two session dates.");
      else
        try {
          const snapshot = this.performance.create(
            {
              valuations: closes.map(([, p]) => ({ id: p.valuationId, revision: 1 })),
              benchmark: null,
            },
            {
              key: "live-perf-" + latest.valuation.id,
              requestId: "live-" + (context.cycleId ?? "manual"),
            },
          );
          performanceId = snapshot.id;
          twr = snapshot.twr.value;
          investmentProfit = snapshot.investmentProfit;
          if (snapshot.twr.status !== "available") reasons.push(snapshot.twr.reason);
        } catch (error) {
          reasons.push(
            "Chapter 15 refused the series: " +
              (error instanceof Error ? error.message : "unknown"),
          );
        }
    }
    const bench =
      sessions.length >= 2
        ? benchmarkReturn(
            this.history.bars(this.policy.benchmark, "1d", 400),
            sessions[0]!,
            sessions.at(-1)!,
          )
        : null;
    if (sessions.length >= 2 && bench === null)
      reasons.push(
        "No final benchmark closes cover " + sessions[0] + " to " + sessions.at(-1) + ".",
      );
    let reportId: string | null = null,
      reportSession: string | null = null;
    if (reportDue) {
      try {
        const monitor = this.risk.latest(portfolioId)?.monitor.id ?? null;
        const report = this.reports.create(
          {
            portfolioId,
            title: "End of day " + context.coversSession,
            asOf: latest.valuation.request.asOf,
            dataCutoff: latest.valuation.request.asOf,
            valuation: { id: latest.valuation.id, revision: 1 },
            monitor: monitor ? { id: monitor, revision: 1 } : null,
            performance: performanceId ? { id: performanceId, revision: 1 } : null,
            attribution: null,
            reconciliation: null,
            target: null,
            batches: [],
            research: [],
            datasets: [],
            supersedes: null,
          },
          {
            key: "live-eod-" + portfolioId.slice(0, 36) + "-" + context.coversSession,
            requestId: "live-" + (context.cycleId ?? "manual"),
          },
        );
        reportId = report.id;
        reportSession = context.coversSession;
      } catch (error) {
        reasons.push(
          "End-of-day report not created: " + (error instanceof Error ? error.message : "unknown"),
        );
      }
    }
    const result = livePerformanceSchema.parse({
      id,
      portfolioId,
      valuationId: latest.valuation.id,
      asOf: latest.valuation.request.asOf,
      policy: livePerformancePolicy,
      performanceId,
      sessions,
      twr,
      investmentProfit,
      benchmark: this.policy.benchmark,
      benchmarkReturn: bench,
      activeReturn: twr !== null && bench !== null ? twr - bench : null,
      reportId,
      reportSession,
      reasons: [
        "Benchmark is a price return from final daily closes; the portfolio TWR is net of recorded fees.",
        ...reasons,
      ],
    });
    this.transactions.run(() => {
      if (!existing)
        this.store.append("live-performance", id, 1, {
          ...result,
          reportId: null,
          reportSession: null,
        });
      if (reportDue && reportId)
        this.store.append("live-eod", portfolioId + "|" + context.coversSession, 1, {
          portfolioId,
          session: context.coversSession,
          reportId,
        });
    });
    const published = this.latest(portfolioId)!;
    this.publish({ type: "performance", data: published });
    return published;
  }

  async refresh(
    context: Pick<RefreshContext, "cycleId" | "coversSession">,
  ): Promise<RefreshTaskOutcome> {
    const portfolios = this.portfolios.listPortfolios();
    const measured = portfolios
      .map((p) => this.measure(p.id, context))
      .filter((r): r is LivePerformance => r !== null);
    const reports = measured.filter(
      (r) => r.reportSession === context.coversSession && r.reportId,
    ).length;
    return {
      status: portfolios.length ? "succeeded" : "skipped",
      requested: portfolios.length,
      succeeded: measured.length,
      detail:
        measured.length +
        " performance measurement(s)" +
        (context.coversSession
          ? ", " + reports + " end-of-day report(s) for " + context.coversSession
          : "") +
        ".",
      failure: null,
    };
  }
}
