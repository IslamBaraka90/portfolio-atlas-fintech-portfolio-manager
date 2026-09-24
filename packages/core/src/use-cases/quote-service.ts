import {
  quoteBoardSchema,
  quoteObservationSchema,
  watchlistSchema,
  type Instrument,
  type LiveEvent,
  type LiveRuntimePolicy,
  type QuoteBoard,
  type QuoteObservation,
  type Watchlist,
  type WatchlistChange,
} from "@portfolio-atlas/contracts";
import { classifyQuote, quotePolicyVersion } from "../domain/live/classify-quote.js";
import type { RefreshContext, RefreshTask, RefreshTaskOutcome } from "../ports/live.js";
import type { RawArchive } from "../ports/market-data.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { QuoteAnalytics, QuoteProvider } from "../ports/quotes.js";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Transactions } from "../ports/transactions.js";
import type { CommandContext, Commands } from "./commands.js";
import { ApplicationError } from "./errors.js";

const emptyBoard: QuoteBoard = { revision: 0, cycleId: null, updatedAt: null, quotes: [] };

// Chapter 19: one batched quote request per cycle for the watchlist plus every saved
// instrument from the same source. Every observation is stored once (the tape);
// a revisioned board holds the latest observation per symbol for the desk.
export class QuoteService {
  constructor(
    private readonly policy: LiveRuntimePolicy,
    private readonly provider: QuoteProvider,
    private readonly analytics: QuoteAnalytics,
    private readonly instruments: { list(): Instrument[] },
    private readonly archive: RawArchive,
    private readonly store: SnapshotRepository,
    private readonly transactions: Transactions,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
    private readonly publish: (event: LiveEvent) => void,
  ) {}

  // The starting watchlist is the configured one in live mode and the provider's
  // teaching symbols in demo mode (Yahoo symbols have no synthetic quotes).
  private defaultWatchlist(): Watchlist {
    return {
      revision: 1,
      symbols:
        this.policy.mode === "demo"
          ? (this.provider.defaultSymbols ?? [])
          : [...this.policy.watchlist],
      updatedAt: this.clock.now(),
    };
  }
  watchlist(): Watchlist {
    return (
      (this.store.get("live-watchlist", "main") as Watchlist | undefined) ?? this.defaultWatchlist()
    );
  }
  changeWatchlist(change: WatchlistChange, context: CommandContext) {
    return this.commands.executeSync("live.watchlist", change, context, () => {
      const stored = this.store.get("live-watchlist", "main") as Watchlist | undefined;
      const current = stored ?? this.defaultWatchlist();
      if (current.revision !== change.expectedRevision)
        throw new ApplicationError(
          "REVISION_CONFLICT",
          "The watchlist changed. Reload it before editing.",
        );
      if (!stored) this.store.append("live-watchlist", "main", 1, current);
      const has = current.symbols.includes(change.symbol);
      if (change.action === "add" && has)
        throw new ApplicationError("INVALID_EVENT", change.symbol + " is already watched.");
      if (change.action === "remove" && !has)
        throw new ApplicationError("NOT_FOUND", change.symbol + " is not on the watchlist.");
      const symbols =
        change.action === "add"
          ? [...current.symbols, change.symbol]
          : current.symbols.filter((s) => s !== change.symbol);
      if (symbols.length > 50)
        throw new ApplicationError("INVALID_EVENT", "A watchlist holds at most 50 symbols.");
      const next = watchlistSchema.parse({
        revision: current.revision + 1,
        symbols,
        updatedAt: this.clock.now(),
      });
      this.store.append("live-watchlist", "main", next.revision, next);
      return next;
    });
  }

  // Watchlist symbols first, then saved instruments from the provider's source.
  tracked(): { symbol: string; instrumentId: string | null }[] {
    const bySymbol = new Map<string, string>();
    for (const instrument of this.instruments.list())
      if (instrument.source === this.provider.mode)
        bySymbol.set(instrument.returnedSymbol, instrument.instrumentId);
    const symbols = [...new Set([...this.watchlist().symbols, ...bySymbol.keys()])];
    return symbols.map((symbol) => ({ symbol, instrumentId: bySymbol.get(symbol) ?? null }));
  }

  board(): QuoteBoard {
    return (this.store.get("live-quote-board", "main") as QuoteBoard | undefined) ?? emptyBoard;
  }
  tape(symbol: string, limit = 200): QuoteObservation[] {
    return (this.store.all("live-quote") as QuoteObservation[])
      .filter((q) => q.symbol === symbol)
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
      .slice(0, limit);
  }

  task(): RefreshTask {
    return { name: "quotes", run: (context) => this.refresh(context) };
  }

  async refresh(context: Pick<RefreshContext, "cycleId">): Promise<RefreshTaskOutcome> {
    const tracked = this.tracked();
    if (!tracked.length)
      return {
        status: "skipped",
        requested: 0,
        succeeded: 0,
        detail: "No watched or saved symbols to quote.",
        failure: null,
      };
    const reply = await this.provider.quotes(tracked.map((t) => t.symbol));
    if (reply.status === "unavailable")
      return {
        status: "failed",
        requested: tracked.length,
        succeeded: 0,
        detail: reply.failure.message,
        failure: reply.failure,
      };
    const { hash } = await this.archive.save(reply.data.raw);
    const instrumentOf = new Map(tracked.map((t) => [t.symbol, t.instrumentId]));
    const base = (symbol: string) => ({
      id: this.ids.next(),
      cycleId: context.cycleId,
      instrumentId: instrumentOf.get(symbol) ?? null,
      source: reply.source,
      observedAt: reply.observedAt,
      sourceHash: hash,
    });
    const observations = [
      ...reply.data.rows.map((row) =>
        classifyQuote(row, { ...base(row.symbol), policy: this.policy }, this.analytics),
      ),
      ...reply.data.missing.map((m) => unavailable(m.symbol, m.reason, base(m.symbol))),
    ];
    const previous = this.board();
    const latest = new Map(previous.quotes.map((q) => [q.symbol, q]));
    for (const q of observations) latest.set(q.symbol, q);
    const order = tracked.map((t) => t.symbol);
    const board = quoteBoardSchema.parse({
      revision: previous.revision + 1,
      cycleId: context.cycleId,
      updatedAt: reply.observedAt,
      // Symbols no longer tracked drop off the board; the tape keeps them.
      quotes: order.map((s) => latest.get(s)).filter((q): q is QuoteObservation => !!q),
    });
    this.transactions.run(() => {
      for (const q of observations)
        this.store.append("live-quote", q.id, 1, quoteObservationSchema.parse(q));
      this.store.append("live-quote-board", "main", board.revision, board);
    });
    this.publish({ type: "quotes", data: board });
    const count = (f: QuoteObservation["freshness"]) =>
      observations.filter((q) => q.freshness === f).length;
    return {
      status: "succeeded",
      requested: tracked.length,
      succeeded: observations.length - count("unavailable"),
      detail:
        observations.length +
        " quotes: " +
        [
          ["live", count("live")],
          ["delayed", count("delayed")],
          ["stale", count("stale")],
          ["closed", count("closed_market")],
          ["unavailable", count("unavailable")],
        ]
          .filter(([, n]) => n)
          .map(([label, n]) => n + " " + label)
          .join(", ") +
        ".",
      failure: null,
    };
  }
}

function unavailable(
  symbol: string,
  reason: string,
  base: {
    id: string;
    cycleId: string | null;
    instrumentId: string | null;
    source: QuoteObservation["source"];
    observedAt: string;
    sourceHash: string | null;
  },
): QuoteObservation {
  const none = null;
  return {
    ...base,
    symbol,
    providerTime: none,
    marketState: none,
    delaySeconds: none,
    quoteUnit: { reported: none, currency: none, scaleToCurrency: none, evidence: "No quote." },
    reportedLast: none,
    last: none,
    bid: none,
    ask: none,
    bidSize: none,
    askSize: none,
    open: none,
    high: none,
    low: none,
    previousClose: none,
    volume: none,
    change: none,
    changePercent: none,
    book: { state: "absent", spread: none, spreadBps: none, midpoint: none },
    freshness: "unavailable",
    ageSeconds: none,
    reasons: [reason],
    policy: quotePolicyVersion,
  };
}
