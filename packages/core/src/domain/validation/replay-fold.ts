import {
  postingInputSchema,
  type HistoricalFixture,
  type ValidationFold,
  type LedgerEvent,
  type JournalEntry,
  type BookState,
  type MarkEvidence,
} from "@portfolio-atlas/contracts";
import type { DrawdownEngine } from "../../ports/validation.js";
import { BookDecimal as D, money, normalizePosting } from "../accounting/decimal.js";
import { postingEntry } from "../accounting/project-book.js";
import { reconcileBook } from "../accounting/reconcile-book.js";
import { valueBook } from "../valuation/value-book.js";

export interface FoldPlan {
  name: string;
  holdout: boolean;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  decisionAt: string;
  scores: { instrumentId: string; score: number }[];
  selectedIds: string[];
}
export function replayFold(
  fixture: HistoricalFixture,
  plan: FoldPlan,
  policy: ValidationFold["policy"],
  feeBps: number,
  drawdown: DrawdownEngine,
): ValidationFold {
  const events: LedgerEvent[] = [],
    journal: JournalEntry[] = [],
    timeline: ValidationFold["timeline"] = [];
  const id = plan.name + "-" + policy + "-" + feeBps;
  const book = (at: string): BookState => ({
    events,
    journal,
    book: reconcileBook(id, events, journal, at),
  });
  function post(value: object, at: string) {
    const input = normalizePosting(
      postingInputSchema.parse({
        portfolioId: id,
        occurredAt: at,
        sourceRef: id + "-" + (events.length + 1),
        ...value,
      }),
    );
    const event: LedgerEvent = {
      id: id + "-" + (events.length + 1),
      portfolioId: id,
      sequence: events.length + 1,
      recordedAt: at,
      instrumentSnapshot:
        "instrumentId" in input
          ? fixture.instruments.find((i) => i.instrumentId === input.instrumentId)!
          : null,
      input,
    };
    journal.push(postingEntry(events, event));
    events.push(event);
  }
  post({ kind: "deposit", currency: "USD", amount: "10000" }, plan.decisionAt);
  timeline.push({
    kind: "decision",
    at: plan.decisionAt,
    detail: "Training ends here; test observations excluded.",
  });
  const entry = fixture.bars[plan.testStart]!;
  if (entry.openAt <= plan.decisionAt) throw new Error("A close decision requires a later open.");
  const eligible = fixture.membership
    .filter((m) => m.from <= plan.decisionAt && (m.to === null || m.to > entry.openAt))
    .map((m) => m.instrumentId);
  const chosen =
    policy === "momentum" ? plan.selectedIds.filter((i) => eligible.includes(i)) : eligible;
  let fees = new D(0);
  function trade(
    kind: "buy" | "sell",
    instrumentId: string,
    shares: string,
    price: number,
    at: string,
  ) {
    const fee = money(new D(shares).mul(price).toDecimalPlaces(2).mul(feeBps).div(10000));
    post(
      {
        kind,
        instrumentId,
        instrumentRevision: 1,
        currency: "USD",
        quantity: shares,
        unitPrice: price.toFixed(8),
        fee,
      },
      at,
    );
    fees = fees.plus(fee);
  }
  for (const instrumentId of chosen) {
    const index = fixture.instruments.findIndex((i) => i.instrumentId === instrumentId),
      price = entry.opens[index]!;
    const shares = new D(8000).div(chosen.length).div(price).floor();
    if (shares.gt(0)) {
      trade("buy", instrumentId, shares.toFixed(8), price, entry.openAt);
      timeline.push({
        kind: "fill",
        at: entry.openAt,
        detail: instrumentId + " buy " + shares.toFixed() + " at " + price,
      });
    }
  }
  const equity: ValidationFold["equity"] = [{ at: plan.decisionAt, nav: "10000.00", drawdown: 0 }];
  for (let index = plan.testStart; index <= plan.testEnd; index++) {
    const bar = fixture.bars[index]!;
    for (const member of fixture.membership) {
      if (member.to === bar.openAt && member.recoveryPrice !== null) {
        const position = book(bar.openAt).book.positions.find(
          (p) => p.instrumentId === member.instrumentId,
        );
        if (position) {
          trade("sell", member.instrumentId, position.quantity, member.recoveryPrice, bar.openAt);
          timeline.push({
            kind: "forced_exit",
            at: bar.openAt,
            detail: member.instrumentId + " authored cash recovery " + member.recoveryPrice,
          });
        }
      }
    }
    const state = book(bar.closeAt);
    const marks: MarkEvidence[] = state.book.positions.map((p) => ({
      instrumentId: p.instrumentId,
      currency: "USD",
      price:
        bar.closes[
          fixture.instruments.findIndex((i) => i.instrumentId === p.instrumentId)
        ]!.toFixed(8),
      status: "accepted",
      quotedAt: bar.closeAt,
      observedAt: bar.availableAt,
      dataset: { id: fixture.id, revision: 1 },
      rowId: bar.session,
      sourceHash: null,
      reviewId: null,
      override: null,
      reasons: [],
    }));
    const value = valueBook(
      state,
      {
        portfolioId: id,
        checkpoint: events.length,
        asOf: bar.closeAt,
        maxPriceAgeSeconds: 1,
        prices: [],
        overrides: [],
        fxRuns: [],
      },
      "USD",
      marks,
      [],
    );
    if (value.totals.nav === null || !state.book.reconciled)
      throw new Error("Simulation accounting did not reconcile.");
    equity.push({ at: bar.closeAt, nav: value.totals.nav, drawdown: 0 });
    timeline.push({
      kind: "valuation",
      at: bar.closeAt,
      detail: "Reconciled close NAV " + value.totals.nav,
    });
  }
  const returns = equity
    .slice(1)
    .map((e, i) => new D(e.nav).div(equity[i]!.nav).minus(1).toNumber());
  const risk = drawdown.calculate(returns);
  equity.slice(1).forEach((e, i) => {
    e.drawdown = risk.drawdowns[i]!;
  });
  return {
    name: plan.name,
    holdout: plan.holdout,
    trainStart: fixture.bars[plan.trainStart]!.session,
    trainEnd: fixture.bars[plan.trainEnd]!.session,
    testStart: entry.session,
    testEnd: fixture.bars[plan.testEnd]!.session,
    decisionAt: plan.decisionAt,
    fittedScores: plan.scores,
    selectedIds: chosen,
    policy,
    feeBps,
    timeline,
    equity,
    returnFraction: new D(equity.at(-1)!.nav).div(10000).minus(1).toNumber(),
    maximumDrawdown: risk.maximumDrawdown,
    fees: money(fees),
    book: book(fixture.bars[plan.testEnd]!.closeAt),
  };
}
