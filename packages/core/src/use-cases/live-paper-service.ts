import type { ExecutionCost, Instrument, PaperBatch, QuoteBoard } from "@portfolio-atlas/contracts";
import { executionCost, quoteFill } from "../domain/live/quote-fill.js";
import type { RefreshContext, RefreshTask, RefreshTaskOutcome } from "../ports/live.js";
import type { PaperExecutionService } from "./paper-execution-service.js";

const fillable = new Set(["accepted", "partially_filled", "cancel_pending"]);

// Chapter 24: each cycle offers every accepted paper order its live quote. The fill
// becomes an ordinary Chapter 12 opening event, so lots, ticks, the 5% protection
// band, partial fills, fees, idempotency and ledger posting are all unchanged. The
// event id is derived from the order and the quote, so the same quote can fill an
// order at most once even if a cycle is replayed.
export class LivePaperService {
  constructor(
    private readonly paper: PaperExecutionService,
    private readonly quotes: { board(): QuoteBoard },
    private readonly instruments: { list(): Instrument[] },
  ) {}

  costs(batchId: string): ExecutionCost[] {
    return this.paper.get(batchId).orders.map(executionCost);
  }

  task(): RefreshTask {
    return { name: "paper", run: (context) => this.refresh(context) };
  }

  async refresh(context: Pick<RefreshContext, "cycleId">): Promise<RefreshTaskOutcome> {
    const active = (this.paper.list() as PaperBatch[]).filter((b) => b.status === "active");
    const symbols = new Map(this.instruments.list().map((i) => [i.instrumentId, i.returnedSymbol]));
    const bySymbol = new Map(this.quotes.board().quotes.map((q) => [q.symbol, q]));
    let offered = 0,
      filled = 0,
      rejected = 0;
    const waits = new Set<string>();
    const refusals: string[] = [];
    for (const snapshot of active) {
      for (const order of snapshot.orders) {
        if (!fillable.has(order.state)) continue;
        offered++;
        const quote = bySymbol.get(symbols.get(order.instrumentId) ?? "");
        const decision = quoteFill(order, quote);
        if (decision.action === "wait") {
          waits.add(decision.reason);
          continue;
        }
        const batch = this.paper.get(snapshot.id);
        const eventId = ("lq" + order.tradeIndex + "-" + decision.live.quoteId).slice(0, 64);
        try {
          const updated = this.paper.apply(
            batch.id,
            {
              eventId,
              expectedRevision: batch.revision,
              orderId: order.id,
              kind: "opening",
              opening: {
                // The fill is recorded when the desk acts on the quote.
                at: new Date(
                  Math.max(Date.parse(quote!.observedAt), Date.parse(order.acceptedAt!) + 1),
                ).toISOString(),
                price: decision.price,
                capacity: decision.capacity,
                live: decision.live,
              },
              reason: "",
            },
            {
              key: "live-fill-" + batch.id.slice(0, 36) + "-" + eventId,
              requestId: "live-cycle-" + (context.cycleId ?? "manual"),
            },
          );
          const after = updated.orders.find((o) => o.id === order.id)!;
          if (after.fills.some((f) => f.eventId === eventId)) filled++;
          // Chapter 12 protection: a market order whose live price moved beyond the
          // approved decision price is rejected, never filled at a worse price.
          else if (after.state === "rejected") rejected++;
        } catch (error) {
          refusals.push(
            order.instrumentId + ": " + (error instanceof Error ? error.message : "refused"),
          );
        }
      }
    }
    return {
      status: offered ? "succeeded" : "skipped",
      requested: offered,
      succeeded: filled,
      detail: offered
        ? filled +
          " of " +
          offered +
          " open paper order(s) filled at live quotes" +
          (rejected ? "; " + rejected + " rejected by price protection" : "") +
          (waits.size ? "; waiting: " + [...waits].join(" ") : "") +
          (refusals.length ? "; refused: " + refusals.join("; ") : "") +
          "."
        : "No accepted paper orders to fill.",
      failure: null,
    };
  }
}
