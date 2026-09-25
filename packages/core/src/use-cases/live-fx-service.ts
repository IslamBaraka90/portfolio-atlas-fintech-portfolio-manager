import {
  currencySchema,
  fxBoardSchema,
  quoteObservationSchema,
  type Currency,
  type FxBoard,
  type FxConversion,
  type LiveEvent,
  type LiveRuntimePolicy,
  type QuoteBoard,
  type QuoteObservation,
} from "@portfolio-atlas/contracts";
import { classifyQuote } from "../domain/live/classify-quote.js";
import {
  convertWithBoard,
  deriveRates,
  requiredLegs,
  requiredPairs,
} from "../domain/live/derive-fx.js";
import type { RefreshContext, RefreshTask, RefreshTaskOutcome } from "../ports/live.js";
import type { RawArchive } from "../ports/market-data.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { QuoteAnalytics, QuoteProvider } from "../ports/quotes.js";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Transactions } from "../ports/transactions.js";
import { ApplicationError } from "./errors.js";

const emptyBoard: FxBoard = {
  revision: 0,
  cycleId: null,
  updatedAt: null,
  source: null,
  rates: [],
  unavailable: [],
};

// Chapter 21: live FX. Each cycle finds the currencies on the quote board and the
// base currencies of saved mandates (USD when there are none), requests one USD leg
// per non-USD currency through the same quote provider and freshness policy, and
// derives every needed pair. Legs are stored on the quote tape like any quote.
export class LiveFxService {
  constructor(
    private readonly policy: LiveRuntimePolicy,
    private readonly provider: QuoteProvider,
    private readonly analytics: QuoteAnalytics,
    private readonly quotes: { board(): QuoteBoard },
    private readonly mandates: { listMandates(): { baseCurrency: Currency }[] },
    private readonly archive: RawArchive,
    private readonly store: SnapshotRepository,
    private readonly transactions: Transactions,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly publish: (event: LiveEvent) => void,
  ) {}

  board(): FxBoard {
    return (this.store.get("live-fx-board", "main") as FxBoard | undefined) ?? emptyBoard;
  }
  bases(): Currency[] {
    const bases = [...new Set(this.mandates.listMandates().map((m) => m.baseCurrency))];
    return bases.length ? bases.sort() : ["USD"];
  }
  convert(amount: string, from: Currency, to: Currency): FxConversion {
    const board = this.board();
    const result = convertWithBoard(amount, from, to, board);
    if (result.converted === null)
      throw new ApplicationError("INVALID_EVENT", result.reasons.join(" "));
    return {
      amount,
      from,
      to,
      converted: result.converted,
      rate: result.rate,
      boardRevision: board.revision,
      rounding: "half-even to 0.01",
      reasons: result.reasons,
    };
  }

  task(): RefreshTask {
    return { name: "fx", run: (context) => this.refresh(context) };
  }

  async refresh(context: Pick<RefreshContext, "cycleId">): Promise<RefreshTaskOutcome> {
    const currencies = this.quotes
      .board()
      .quotes.map((q) => q.quoteUnit.currency)
      .filter((c): c is string => !!c);
    const { pairs, unsupported } = requiredPairs(currencies, this.bases());
    const legs = requiredLegs(pairs);
    const notes = unsupported.length
      ? " Unsupported currencies ignored: " + unsupported.join(", ") + "."
      : "";
    if (!pairs.length)
      return {
        status: "skipped",
        requested: 0,
        succeeded: 0,
        detail: "Every quoted currency matches the base currency; no FX needed." + notes,
        failure: null,
      };
    let observations: QuoteObservation[] = [];
    let source: FxBoard["source"] = this.provider.mode;
    let observedAt = this.clock.now();
    if (legs.length) {
      const reply = await this.provider.quotes(legs);
      if (reply.status === "unavailable")
        return {
          status: "failed",
          requested: legs.length,
          succeeded: 0,
          detail: reply.failure.message,
          failure: reply.failure,
        };
      const { hash } = await this.archive.save(reply.data.raw);
      source = reply.source;
      observedAt = reply.observedAt;
      observations = reply.data.rows.map((row) =>
        classifyQuote(
          row,
          {
            id: this.ids.next(),
            cycleId: context.cycleId,
            instrumentId: null,
            source: reply.source,
            observedAt,
            sourceHash: hash,
            policy: this.policy,
          },
          this.analytics,
        ),
      );
    }
    const { rates, unavailable } = deriveRates(
      pairs,
      new Map(observations.map((q) => [q.symbol, q])),
      {
        observedAt,
        cycleId: context.cycleId,
        // FX follows the cadence freshness plus any declared exchange delay.
        maxAgeSeconds:
          this.policy.freshnessSeconds +
          Math.max(0, ...observations.map((q) => q.delaySeconds ?? 0)),
      },
    );
    const previous = this.board();
    const board = fxBoardSchema.parse({
      revision: previous.revision + 1,
      cycleId: context.cycleId,
      updatedAt: observedAt,
      source,
      rates,
      unavailable,
    });
    this.transactions.run(() => {
      for (const q of observations)
        this.store.append("live-quote", q.id, 1, quoteObservationSchema.parse(q));
      this.store.append("live-fx-board", "main", board.revision, board);
    });
    this.publish({ type: "fx", data: board });
    return {
      status: rates.length ? "succeeded" : "failed",
      requested: pairs.length,
      succeeded: rates.length,
      detail:
        rates.length +
        " of " +
        pairs.length +
        " pairs from " +
        legs.length +
        " USD legs" +
        (unavailable.length
          ? "; unavailable: " + unavailable.map((u) => u.base + u.quote).join(", ")
          : "") +
        "." +
        notes,
      failure: rates.length
        ? null
        : { code: "NOT_FOUND", message: "No FX leg was usable.", retryable: true },
    };
  }
}

export const isCurrency = (value: string): value is Currency =>
  currencySchema.safeParse(value).success;
