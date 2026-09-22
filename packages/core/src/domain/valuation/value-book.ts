import type {
  BookState,
  FxObservation,
  MarkEvidence,
  ValuationRequest,
  ValuationSnapshot,
} from "@portfolio-atlas/contracts";
import { BookDecimal as D, money, signedMoney, zero } from "../accounting/decimal.js";
type Currency = ValuationSnapshot["baseCurrency"];
export function valueBook(
  book: BookState,
  request: ValuationRequest,
  baseCurrency: Currency,
  marks: MarkEvidence[],
  fxEvidence: FxObservation[],
) {
  function convert(amount: string, from: Currency) {
    // Known zero cash has zero base value without inventing a missing FX quote.
    if (from === baseCurrency || new D(amount).isZero())
      return { value: amount, fxId: null, reasons: [] as string[] };
    const fx = fxEvidence.find(
      (q) =>
        (q.baseCurrency === from && q.quoteCurrency === baseCurrency) ||
        (q.quoteCurrency === from && q.baseCurrency === baseCurrency),
    );
    if (!fx)
      return {
        value: null,
        fxId: null,
        reasons: ["Missing FX from " + from + " to " + baseCurrency + "."],
      };
    const at = Date.parse(request.asOf),
      observed = Date.parse(fx.observedAt),
      available = Date.parse(fx.availableAt);
    if (
      observed > at ||
      available > at ||
      available < observed ||
      at - observed > fx.maxAgeSeconds * 1000
    )
      return {
        value: null,
        fxId: fx.id,
        reasons: ["FX is stale or unavailable at the requested cutoff."],
      };
    const value = new D(amount),
      rate = new D(fx.quotePerBase.toString());
    return {
      value: money(fx.baseCurrency === from ? value.mul(rate) : value.div(rate)),
      fxId: fx.id,
      reasons: [] as string[],
    };
  }
  const cash = book.book.cash.map((c) => {
    const converted = convert(c.economic ?? c.settled, c.currency);
    return {
      currency: c.currency,
      amount: c.economic ?? c.settled,
      baseAmount: converted.value,
      fxId: converted.fxId,
      reasons: converted.reasons,
    };
  });
  const positions = book.book.positions.map((position) => {
    const mark = marks.find((m) => m.instrumentId === position.instrumentId);
    if (!mark) throw new Error("Valuation mark mapping omitted a book position.");
    const local = new D(position.quantity).isZero()
      ? "0.00"
      : mark.price === null
        ? null
        : money(new D(position.quantity).mul(mark.price));
    const converted =
      local === null
        ? { value: null, fxId: null, reasons: ["Holding has no accepted market price."] }
        : convert(local, position.currency);
    return {
      instrumentId: position.instrumentId,
      currency: position.currency,
      quantity: position.quantity,
      costBasis: position.costBasis,
      mark,
      marketValueLocal: local,
      marketValueBase: converted.value,
      fxId: converted.fxId,
      reasons: [...mark.reasons, ...converted.reasons],
    };
  });
  function total(values: (string | null)[]) {
    return values.some((v) => v === null)
      ? null
      : money(values.reduce<InstanceType<typeof D>>((sum, v) => sum.plus(v!), zero()));
  }
  const cashBase = total(cash.map((c) => c.baseAmount)),
    holdingsBase = total(positions.map((p) => p.marketValueBase));
  const nav =
    cashBase === null || holdingsBase === null ? null : money(new D(cashBase).plus(holdingsBase));
  return {
    baseCurrency,
    book: book.book,
    status: nav === null ? ("incomplete" as const) : ("complete" as const),
    positions,
    cash,
    fxEvidence,
    totals: { cashBase, holdingsBase, nav },
    coverage: {
      valuedHoldings: positions.filter((p) => p.marketValueBase !== null).length,
      totalHoldings: positions.length,
      valuedCashCurrencies: cash.filter((c) => c.baseAmount !== null).length,
      totalCashCurrencies: cash.length,
    },
    externalCapital: book.book.accounts
      .filter((a) => a.account === "contributed_capital")
      .map((a) => ({
        currency: a.currency,
        netContributed: signedMoney(new D(a.credits).minus(a.debits)),
      })),
    warnings: [
      "Current reconstruction from recorded evidence; not historical point-in-time performance.",
      "External deposits change NAV without creating investment return.",
      "NAV uses economic cash (settled plus receivables minus payables). Reservations are not subtracted twice.",
      ...(marks.some((m) => m.override !== null)
        ? [
            "Manual teaching overrides assert current book share units; inspect their reasons and recorded times.",
          ]
        : []),
    ],
  };
}
