import {
  navPointSchema,
  valuationSnapshotSchema,
  type FxBoard,
  type Instrument,
  type LiveEvent,
  type LiveRuntimePolicy,
  type NavPoint,
  type QuoteBoard,
  type ValuationRequest,
  type ValuationSnapshot,
} from "@portfolio-atlas/contracts";
import { canonical, type CommandContext, type Commands } from "./commands.js";
import { liveMarkPolicy, selectLiveMark } from "../domain/live/select-live-mark.js";
import { valueBook } from "../domain/valuation/value-book.js";
import type { RefreshContext, RefreshTask, RefreshTaskOutcome } from "../ports/live.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Transactions } from "../ports/transactions.js";
import { ApplicationError } from "./errors.js";
import type { LedgerService } from "./ledger-service.js";
import type { PortfolioService } from "./portfolio-service.js";

// Chapter 22: value every portfolio from live marks each cycle. The valuation is an
// ordinary valuation snapshot (policy chapter-22.live-mark.v1) built by the same
// valueBook arithmetic as Chapter 6, so Chapters 14–16 can monitor, measure and
// report on it. A NAV point is added only when the inputs changed: the same book
// checkpoint, marks and FX produce one point, not one per cycle.
export class LiveValuationService {
  constructor(
    private readonly policy: LiveRuntimePolicy,
    private readonly store: SnapshotRepository,
    private readonly transactions: Transactions,
    private readonly ledger: LedgerService,
    private readonly portfolios: PortfolioService,
    private readonly instruments: { list(): Instrument[] },
    private readonly quotes: { board(): QuoteBoard },
    private readonly fx: { board(): FxBoard },
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
    private readonly publish: (event: LiveEvent) => void,
  ) {}

  navSeries(portfolioId: string, limit = 500): NavPoint[] {
    this.portfolios.getPortfolio(portfolioId);
    const prefix = portfolioId + "|";
    const rows = (
      this.store.prefixed
        ? this.store.prefixed("live-nav", prefix)
        : (this.store.all("live-nav") as NavPoint[]).filter((p) => p.portfolioId === portfolioId)
    ) as NavPoint[];
    return rows.sort((a, b) => a.asOf.localeCompare(b.asOf)).slice(-limit);
  }
  latest(portfolioId: string): { point: NavPoint; valuation: ValuationSnapshot } | null {
    const point = this.navSeries(portfolioId, 1)[0];
    if (!point) return null;
    return {
      point,
      valuation: valuationSnapshotSchema.parse(this.store.get("valuation", point.valuationId, 1)),
    };
  }

  // Builds the valuation without storing it. Returns null for an unreconciled book.
  private build(portfolioId: string) {
    const now = this.clock.now();
    const portfolio = this.portfolios.getPortfolio(portfolioId);
    const checkpoint = this.ledger.get(portfolioId).events.length;
    const book = this.ledger.atCheckpoint(portfolioId, checkpoint, now);
    if (!book.book.reconciled) return null;
    const symbols = new Map(this.instruments.list().map((i) => [i.instrumentId, i.returnedSymbol]));
    const board = this.quotes.board();
    const bySymbol = new Map(board.quotes.map((q) => [q.symbol, q]));
    const marks = book.book.positions.map((position) =>
      selectLiveMark(position, bySymbol.get(symbols.get(position.instrumentId) ?? "")),
    );
    // Only usable rates enter valuation; stale legs leave the conversion missing.
    const fxEvidence = this.fx
      .board()
      .rates.filter((r) => r.freshness !== "stale" && r.freshness !== "unavailable")
      .map((r) => r.observation);
    const request: ValuationRequest = {
      portfolioId,
      checkpoint,
      asOf: now,
      maxPriceAgeSeconds: Math.min(this.policy.freshnessSeconds, 30 * 86_400),
      prices: [],
      overrides: [],
      fxRuns: [],
    };
    const snapshot = valuationSnapshotSchema.parse({
      id: this.ids.next(),
      revision: 1,
      createdAt: now,
      policyVersion: liveMarkPolicy,
      request,
      ...valueBook(book, request, portfolio.baseCurrency, marks, fxEvidence),
    });
    // Two valuations with the same checkpoint, marks and rates are the same point.
    const fingerprint = canonical({
      checkpoint,
      marks: marks.map((m) => [m.instrumentId, m.price, m.quotedAt, m.status]),
      fx: fxEvidence.map((f) => [f.baseCurrency, f.quoteCurrency, f.quotePerBase, f.observedAt]),
      nav: snapshot.totals.nav,
    });
    return { snapshot, fingerprint };
  }

  private record(
    snapshot: ValuationSnapshot,
    fingerprint: string,
    cycleId: string | null,
  ): NavPoint {
    const point = navPointSchema.parse({
      portfolioId: snapshot.request.portfolioId,
      valuationId: snapshot.id,
      cycleId,
      asOf: snapshot.request.asOf,
      checkpoint: snapshot.request.checkpoint,
      baseCurrency: snapshot.baseCurrency,
      nav: snapshot.totals.nav,
      holdings: snapshot.totals.holdingsBase,
      cash: snapshot.totals.cashBase,
      status: snapshot.status,
      valuedHoldings: snapshot.coverage.valuedHoldings,
      totalHoldings: snapshot.coverage.totalHoldings,
      fingerprint,
    });
    this.store.append("valuation", snapshot.id, 1, snapshot);
    this.store.append("live-nav", point.portfolioId + "|" + point.asOf, 1, point);
    return point;
  }

  // Manual valuation for one portfolio; returns the existing point when unchanged.
  valueNow(portfolioId: string, context: CommandContext) {
    const point = this.commands.executeSync("live.valuation", { portfolioId }, context, () => {
      const built = this.build(portfolioId);
      if (!built)
        throw new ApplicationError("BOOK_INVARIANT", "Only a reconciled book can be valued.");
      const last = this.navSeries(portfolioId, 1)[0];
      if (last?.fingerprint === built.fingerprint) return last;
      return this.record(built.snapshot, built.fingerprint, null);
    });
    this.publish({ type: "nav", data: point });
    return point;
  }

  task(): RefreshTask {
    return { name: "valuation", run: (context) => this.refresh(context) };
  }

  async refresh(context: Pick<RefreshContext, "cycleId">): Promise<RefreshTaskOutcome> {
    const portfolios = this.portfolios.listPortfolios();
    if (!portfolios.length)
      return {
        status: "skipped",
        requested: 0,
        succeeded: 0,
        detail: "No portfolios to value.",
        failure: null,
      };
    const points: NavPoint[] = [];
    let unchanged = 0,
      skipped = 0;
    for (const portfolio of portfolios) {
      const built = this.build(portfolio.id);
      if (!built) {
        skipped++;
        continue;
      }
      const last = this.navSeries(portfolio.id, 1)[0];
      if (last?.fingerprint === built.fingerprint) {
        unchanged++;
        continue;
      }
      points.push(
        this.transactions.run(() =>
          this.record(built.snapshot, built.fingerprint, context.cycleId),
        ),
      );
    }
    for (const point of points) this.publish({ type: "nav", data: point });
    const incomplete = points.filter((p) => p.status === "incomplete").length;
    return {
      status: "succeeded",
      requested: portfolios.length,
      succeeded: points.length + unchanged,
      detail:
        points.length +
        " new NAV point(s), " +
        unchanged +
        " unchanged" +
        (incomplete ? ", " + incomplete + " incomplete" : "") +
        (skipped ? ", " + skipped + " unreconciled book(s) skipped" : "") +
        ".",
      failure: null,
    };
  }
}
