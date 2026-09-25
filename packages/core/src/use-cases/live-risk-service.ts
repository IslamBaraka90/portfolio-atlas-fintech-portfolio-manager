import {
  liveRiskSchema,
  type Instrument,
  type LiveEvent,
  type LiveRisk,
  type LiveRuntimePolicy,
  type MonitorSnapshot,
} from "@portfolio-atlas/contracts";
import { liveRisk, type LiveRiskAnalytics } from "../domain/live/live-risk.js";
import { BookDecimal } from "../domain/accounting/decimal.js";
import type { RefreshContext, RefreshTask, RefreshTaskOutcome } from "../ports/live.js";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Transactions } from "../ports/transactions.js";
import type { LiveHistoryService } from "./live-history-service.js";
import type { LiveValuationService } from "./live-valuation-service.js";
import type { MonitorService } from "./monitor-service.js";
import type { PortfolioService } from "./portfolio-service.js";

// Chapter 23: once per new live valuation, estimate risk from final daily bars and
// the live NAV series, then run the Chapter 14 monitor on that valuation. The
// monitor keeps its own rules: one finding per breach, updated rather than
// duplicated, and a stale valuation can never resolve an open breach.
export class LiveRiskService {
  constructor(
    private readonly policy: LiveRuntimePolicy,
    private readonly store: SnapshotRepository,
    private readonly transactions: Transactions,
    private readonly portfolios: PortfolioService,
    private readonly valuations: LiveValuationService,
    private readonly history: LiveHistoryService,
    private readonly instruments: { list(): Instrument[] },
    private readonly monitors: MonitorService,
    private readonly analytics: LiveRiskAnalytics,
    private readonly publish: (event: LiveEvent) => void,
  ) {}

  latest(portfolioId: string): LiveRisk | null {
    this.portfolios.getPortfolio(portfolioId);
    const prefix = portfolioId + "|";
    const rows = (
      this.store.prefixed
        ? this.store.prefixed("live-risk", prefix)
        : (this.store.all("live-risk") as LiveRisk[]).filter((r) => r.portfolioId === portfolioId)
    ) as LiveRisk[];
    return rows.sort((a, b) => a.asOf.localeCompare(b.asOf)).at(-1) ?? null;
  }

  task(): RefreshTask {
    return { name: "risk", run: (context) => this.refresh(context) };
  }

  assess(portfolioId: string, cycleId: string | null): LiveRisk | null {
    const latest = this.valuations.latest(portfolioId);
    if (!latest) return null;
    const id = portfolioId + "|" + latest.valuation.id;
    if (this.store.get("live-risk", id)) return null;
    const { valuation } = latest;
    const nav = valuation.totals.nav === null ? null : new BookDecimal(valuation.totals.nav);
    const symbols = new Map(this.instruments.list().map((i) => [i.instrumentId, i.returnedSymbol]));
    const holdings = valuation.positions
      .filter((p) => new BookDecimal(p.quantity).gt(0))
      .map((p) => {
        const symbol = symbols.get(p.instrumentId) ?? null;
        return {
          instrumentId: p.instrumentId,
          symbol,
          // Weight of NAV in base currency; an unvalued holding carries no weight.
          weight:
            nav && !nav.isZero() && p.marketValueBase !== null
              ? new BookDecimal(p.marketValueBase).div(nav).toNumber()
              : 0,
          bars: symbol ? this.history.bars(symbol, "1d", 400) : [],
        };
      });
    const navs = this.valuations
      .navSeries(portfolioId, 61)
      .filter((p) => p.nav !== null)
      .map((p) => Number(p.nav));
    const risk = liveRisk({
      portfolioId,
      valuationId: valuation.id,
      asOf: valuation.request.asOf,
      benchmark: this.policy.benchmark,
      holdings,
      benchmarkBars: this.history.bars(this.policy.benchmark, "1d", 400),
      navs,
      analytics: this.analytics,
    });
    let monitor: LiveRisk["monitor"] = {
      id: null,
      breaches: 0,
      unavailable: 0,
      passes: 0,
      reason: null,
    };
    try {
      const snapshot: MonitorSnapshot = this.monitors.create(
        {
          valuation: { id: valuation.id, revision: 1 },
          riskModel: null,
          target: null,
          shock: -0.1,
        },
        { key: "live-monitor-" + valuation.id, requestId: "live-cycle-" + (cycleId ?? "manual") },
      );
      const count = (s: string) => snapshot.observations.filter((o) => o.status === s).length;
      monitor = {
        id: snapshot.id,
        breaches: count("breach"),
        unavailable: count("unavailable"),
        passes: count("pass"),
        reason: snapshot.fresh ? null : snapshot.freshnessReasons.join(" "),
      };
    } catch (error) {
      monitor.reason =
        "Monitor did not run: " + (error instanceof Error ? error.message : "unknown error");
    }
    const result = liveRiskSchema.parse({ ...risk, monitor });
    this.transactions.run(() => this.store.append("live-risk", id, 1, result));
    this.publish({ type: "risk", data: result });
    return result;
  }

  async refresh(context: Pick<RefreshContext, "cycleId">): Promise<RefreshTaskOutcome> {
    const portfolios = this.portfolios.listPortfolios();
    const assessed = portfolios
      .map((p) => this.assess(p.id, context.cycleId))
      .filter((r): r is LiveRisk => r !== null);
    const breaches = assessed.reduce((n, r) => n + r.monitor.breaches, 0);
    return {
      status: portfolios.length ? "succeeded" : "skipped",
      requested: portfolios.length,
      succeeded: assessed.length,
      detail:
        assessed.length +
        " new risk assessment(s)" +
        (breaches ? ", " + breaches + " limit breach observation(s)" : "") +
        "; unchanged valuations are not reassessed.",
      failure: null,
    };
  }
}
