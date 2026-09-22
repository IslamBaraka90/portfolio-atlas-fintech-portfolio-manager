import type {
  ValuationSnapshot,
  LedgerEvent,
  BenchmarkResult,
  PerformanceSnapshot,
  InvestorFlow,
} from "@portfolio-atlas/contracts";
import { BookDecimal as D, signedMoney } from "../accounting/decimal.js";
import { moneyWeighted } from "./money-weighted.js";
type Metric = PerformanceSnapshot["twr"];
const metric = (value: number | null, reason: string): Metric => ({
  status: value === null ? "unavailable" : "available",
  value,
  reason,
});
export function calculatePerformance(
  valuations: ValuationSnapshot[],
  events: LedgerEvent[],
  benchmark: BenchmarkResult | null,
) {
  const first = valuations[0]!,
    last = valuations.at(-1)!,
    currency = first.baseCurrency,
    global: string[] = [];
  if (
    valuations.some(
      (v) =>
        v.status !== "complete" ||
        v.totals.nav === null ||
        !v.book.reconciled ||
        new D(v.totals.nav ?? 0).abs().gt(1e9),
    )
  )
    global.push(
      "Complete reconciled valuations within the one-billion numeric boundary are required.",
    );
  if (events.some((e) => e.input.kind === "reversal"))
    global.push("Interval includes a correction; an explicit restatement workflow is required.");
  const externalFlows: InvestorFlow[] = events
    .filter((e) => e.input.kind === "deposit" || e.input.kind === "withdrawal")
    .map((e) => {
      const input = e.input;
      if (input.kind !== "deposit" && input.kind !== "withdrawal")
        throw new Error("Unexpected flow.");
      if (input.currency !== currency)
        global.push(
          "External flow needs event-time FX; cross-currency performance is unavailable.",
        );
      return {
        at: input.occurredAt,
        amount: signedMoney(new D(input.amount).times(input.kind === "deposit" ? 1 : -1)),
        sourceRef: e.id,
      };
    });
  const periods: PerformanceSnapshot["periods"] = [];
  let netFactor = new D(1),
    grossFactor = new D(1),
    netAvailable = true,
    grossAvailable = true;
  for (let i = 1; i < valuations.length; i++) {
    const a = valuations[i - 1]!,
      b = valuations[i]!,
      begin = new D(a.totals.nav ?? 0),
      end = new D(b.totals.nav ?? 0),
      between = events.filter(
        (e) => e.sequence > a.book.checkpoint && e.sequence <= b.book.checkpoint,
      ),
      reasons: string[] = [];
    if (
      between.some(
        (e) =>
          Date.parse(e.input.occurredAt) < Date.parse(a.request.asOf) ||
          Date.parse(e.input.occurredAt) > Date.parse(b.request.asOf),
      )
    )
      global.push("Journal occurred time falls outside its valuation interval.");
    const flows = externalFlows.filter((f) => between.some((e) => e.id === f.sourceRef));
    const total = flows.reduce((s, f) => s.plus(f.amount), new D(0));
    // A single immediate flow can be bridged after recording only when the
    // same marked holdings/FX and exact NAV difference prove no observed value change.
    const signature = (v: ValuationSnapshot) =>
      JSON.stringify({
        positions: v.positions.map((p) => ({
          id: p.instrumentId,
          quantity: p.quantity,
          currency: p.currency,
          value: p.marketValueBase,
          price: p.mark.price,
          quotedAt: p.mark.quotedAt,
          sourceHash: p.mark.sourceHash,
          dataset: p.mark.dataset,
          rowId: p.mark.rowId,
          reviewId: p.mark.reviewId,
          override: p.mark.override,
        })),
        fx: v.fxEvidence,
      });
    const bridge =
      flows.length === 1 &&
      between.length === 1 &&
      Date.parse(b.request.asOf) - Date.parse(a.request.asOf) <= 60000 &&
      signature(a) === signature(b) &&
      end.minus(begin).eq(total);
    if (!bridge && flows.some((f) => Date.parse(f.at) !== Date.parse(b.request.asOf)))
      reasons.push("Missing valuation at an external-flow instant; exact TWR unavailable.");
    if (begin.lte(0)) reasons.push("Beginning capital must be positive.");
    const feeRows = between.filter((e) => e.input.kind === "fee" || "fee" in e.input);
    const foreignFees = feeRows.some((e) => "currency" in e.input && e.input.currency !== currency);
    const fees = feeRows.reduce(
      (s, e) =>
        s.plus(e.input.kind === "fee" ? e.input.amount : "fee" in e.input ? e.input.fee : 0),
      new D(0),
    );
    if (global.length) reasons.push(...global);
    const net = reasons.length ? null : end.minus(total).div(begin).minus(1);
    const gross =
      net === null || foreignFees ? null : end.plus(fees).minus(total).div(begin).minus(1);
    if (net === null) netAvailable = false;
    else netFactor = netFactor.times(net.plus(1));
    if (gross === null) grossAvailable = false;
    else grossFactor = grossFactor.times(gross.plus(1));
    periods.push({
      from: a.request.asOf,
      to: b.request.asOf,
      begin: begin.toFixed(2),
      end: end.toFixed(2),
      externalFlow: signedMoney(total),
      fees: foreignFees ? "unavailable" : signedMoney(fees),
      netReturn: net?.toNumber() ?? null,
      feeAddedBackReturn: gross?.toNumber() ?? null,
      reasons: [
        ...(bridge
          ? [
              "Verified immediate flow-only bridge: unchanged marked holdings and FX, exact NAV change equals external flow.",
            ]
          : []),
        ...reasons,
        ...(foreignFees ? ["Fee add-back needs event-time FX."] : []),
      ],
    });
  }
  // An invalid later interval invalidates the entire linked result.
  if (global.length) {
    netAvailable = false;
    grossAvailable = false;
    for (const p of periods) {
      p.netReturn = null;
      p.feeAddedBackReturn = null;
      p.reasons.push(...global);
    }
  }
  const begin = new D(first.totals.nav ?? 0),
    end = new D(last.totals.nav ?? 0),
    totalFlow = externalFlows.reduce((s, f) => s.plus(f.amount), new D(0)),
    profit = end.minus(begin).minus(totalFlow),
    duration = Date.parse(last.request.asOf) - Date.parse(first.request.asOf);
  const weighted =
      duration > 0
        ? externalFlows.reduce(
            (s, f) =>
              s.plus(
                new D(f.amount).times(
                  (Date.parse(last.request.asOf) - Date.parse(f.at)) / duration,
                ),
              ),
            new D(0),
          )
        : new D(0),
    denominator = begin.plus(weighted);
  const investorFlows: InvestorFlow[] = [
    {
      at: first.request.asOf,
      amount: signedMoney(begin.negated()),
      sourceRef: "opening:" + first.id,
    },
    ...externalFlows.map((f) => ({ ...f, amount: signedMoney(new D(f.amount).negated()) })),
    { at: last.request.asOf, amount: signedMoney(end), sourceRef: "ending:" + last.id },
  ];
  const mw = moneyWeighted(
    global.length ? [] : investorFlows,
    first.request.asOf,
    last.request.asOf,
  );
  if (global.length) mw.reason = global.join(" ");
  const twr = metric(
    netAvailable ? netFactor.minus(1).toNumber() : null,
    netAvailable
      ? "Exact flow-boundary subperiods linked geometrically; net of recorded costs."
      : periods.flatMap((p) => p.reasons).join(" "),
  );
  const comparison: PerformanceSnapshot["comparison"] = {
    status: "unavailable",
    reason: "No benchmark selected.",
    benchmarkReturn: null,
    activeReturn: null,
  };
  if (benchmark) {
    const startRow = benchmark.series.find((r) => r.date === first.request.asOf.slice(0, 10)),
      endRow = benchmark.series.find((r) => r.date === last.request.asOf.slice(0, 10));
    const compatible =
      benchmark.status === "ready" &&
      benchmark.definition.input.currency === currency &&
      benchmark.definition.input.returnBasis === "gross_total_return" &&
      first.request.asOf.endsWith("T23:59:59.999Z") &&
      last.request.asOf.endsWith("T23:59:59.999Z") &&
      startRow &&
      endRow &&
      twr.value !== null &&
      duration > 0;
    if (compatible) {
      comparison.status = "compatible";
      comparison.benchmarkReturn = endRow.level / startRow.level - 1;
      comparison.activeReturn = twr.value! - comparison.benchmarkReturn;
      comparison.reason =
        "Portfolio net received-income return versus gross-reinvested benchmark, same currency/session endpoints; costs differ explicitly.";
    } else {
      comparison.status = "incompatible";
      comparison.reason =
        "Need same currency, gross-total-return benchmark, exact session endpoints, UTC end-of-day cutoffs and available TWR.";
    }
  }
  return {
    externalFlows,
    investorFlows,
    periods,
    twr,
    feeAddedBackTwr: metric(
      grossAvailable ? grossFactor.minus(1).toNumber() : null,
      "Adds back only recorded standalone and trade fees per subperiod; not a reconstructed investable gross strategy.",
    ),
    modifiedDietz: metric(
      !global.length && duration > 0 && denominator.gt(0)
        ? profit.div(denominator).toNumber()
        : null,
      "Approximation using actual elapsed-time flow weights; requires positive duration and weighted capital.",
    ),
    moneyWeighted: mw,
    investmentProfit: global.length ? null : signedMoney(profit),
    comparison,
    warnings: [
      "Opening capital and external deposits/withdrawals are not investment profit.",
      "Period returns are not annualized headlines. IRR annualization is secondary only after at least 365 elapsed days.",
      "Income includes recorded cash receipts; unrecorded accruals, withholding and tax are not inferred.",
      "Exact TWR requires every external-flow instant as a valuation boundary. Dietz is labeled approximate.",
      "Foreign external-flow FX and correction restatements require separate policies and remain unavailable.",
    ],
  };
}
