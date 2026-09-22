import type { BookState, StatementSnapshot, ReconciliationRun } from "@portfolio-atlas/contracts";
import { BookDecimal as D, money } from "../accounting/decimal.js";
import { activeEvents } from "../accounting/project-book.js";
export function reconcileStatement(
  statement: StatementSnapshot,
  book: BookState,
  expectedTrades: ReconciliationRun["expectedTrades"],
) {
  const breaks: ReconciliationRun["breaks"] = [],
    matchedFillIds: string[] = [];
  function add(
    category: ReconciliationRun["breaks"][number]["category"],
    subject: string,
    expected: string | null,
    observed: string | null,
    reason: string,
    candidateIds: string[] = [],
  ) {
    breaks.push({
      id: "break-" + (breaks.length + 1),
      category,
      subject,
      expected,
      observed,
      reason,
      sourceRef: statement.sourceRef,
      candidateIds,
    });
  }
  const candidates = statement.trades.map((line) =>
    expectedTrades.filter((t) =>
      line.fillId
        ? t.fillId === line.fillId
        : t.instrumentId === line.instrumentId &&
          t.side === line.side &&
          t.tradeDate === line.tradeDate,
    ),
  );
  const useCount = new Map<string, number>();
  for (const rows of candidates)
    for (const t of rows) useCount.set(t.fillId!, 1 + (useCount.get(t.fillId!) ?? 0));
  statement.trades.forEach((line, index) => {
    const possible = candidates[index]!;
    if (!possible.length) {
      add(
        "missing",
        line.lineId,
        null,
        line.fillId,
        "Statement trade has no matching selected paper fill.",
      );
      return;
    }
    if (possible.length !== 1 || (useCount.get(possible[0]!.fillId!) ?? 0) > 1) {
      add(
        "ambiguous",
        line.lineId,
        null,
        line.fillId,
        "Candidate reuse or multiple candidates cannot clear a fill.",
        possible.map((p) => p.fillId!),
      );
      return;
    }
    const expected = possible[0]!,
      before = breaks.length;
    for (const [field, category] of [
      ["quantity", "quantity"],
      ["netCash", "cash"],
      ["fee", "fee"],
    ] as const)
      if (!new D(expected[field]).eq(line[field]))
        add(
          category,
          line.lineId + ":" + field,
          expected[field],
          line[field],
          "Exact decimal comparison; no hidden tolerance.",
          [expected.fillId!],
        );
    for (const field of ["tradeDate", "valueDate"] as const)
      if (expected[field] !== line[field])
        add(
          "date",
          line.lineId + ":" + field,
          expected[field],
          line[field],
          "Trade and settlement dates are distinct.",
          [expected.fillId!],
        );
    if (expected.currency !== line.currency)
      add(
        "currency",
        line.lineId,
        expected.currency,
        line.currency,
        "Currency cannot be inferred or netted.",
        [expected.fillId!],
      );
    if (expected.instrumentId !== line.instrumentId || expected.side !== line.side)
      add(
        "missing",
        line.lineId,
        expected.instrumentId + " " + expected.side,
        line.instrumentId + " " + line.side,
        "Stable fill ID contradicts its economic identity.",
        [expected.fillId!],
      );
    if (breaks.length === before) matchedFillIds.push(expected.fillId!);
  });
  for (const trade of expectedTrades)
    if (!useCount.has(trade.fillId!))
      add(
        "missing",
        trade.fillId!,
        trade.quantity,
        null,
        "Selected paper fill has no statement line.",
        [trade.fillId!],
      );
  const positionIds = new Set([
    ...book.book.positions.map((p) => p.instrumentId),
    ...statement.positions.map((p) => p.instrumentId),
  ]);
  for (const id of positionIds) {
    const local = book.book.positions.find((p) => p.instrumentId === id),
      external = statement.positions.find((p) => p.instrumentId === id);
    const expected = local?.custodyQuantity ?? local?.quantity ?? "0",
      observed = external?.settledQuantity ?? "0";
    if (!new D(expected).eq(observed))
      add(
        "quantity",
        "Custody " + id,
        expected,
        observed,
        "Compare settled custody, not pending trade-date exposure.",
      );
    if (local && external && local.currency !== external.currency)
      add(
        "currency",
        "Custody " + id,
        local.currency,
        external.currency,
        "Custody currency differs.",
      );
  }
  const currencies = new Set([
    ...book.book.cash.map((c) => c.currency),
    ...statement.cash.map((c) => c.currency),
  ]);
  for (const currency of currencies) {
    const expected = book.book.cash.find((c) => c.currency === currency)?.settled ?? "0",
      observed = statement.cash.find((c) => c.currency === currency)?.settled ?? "0";
    if (!new D(expected).eq(observed))
      add(
        "cash",
        "Settled " + currency,
        expected,
        observed,
        "Receivables, payables and order reservations are shown separately in the book.",
      );
  }
  const receipts = new Map<
    string,
    { instrumentId: string; currency: string; amount: InstanceType<typeof D> }
  >();
  for (const event of activeEvents(book.events)) {
    const input = event.input;
    if (input.kind !== "dividend") continue;
    const old = receipts.get(input.evidenceRef);
    if (old && (old.instrumentId !== input.instrumentId || old.currency !== input.currency)) {
      add(
        "ambiguous",
        "Action " + input.evidenceRef,
        null,
        null,
        "One evidence reference spans different action identities.",
      );
      continue;
    }
    receipts.set(input.evidenceRef, {
      instrumentId: input.instrumentId,
      currency: input.currency,
      amount: (old?.amount ?? new D(0)).plus(input.amount),
    });
  }
  for (const ref of new Set([...receipts.keys(), ...statement.actions.map((a) => a.actionRef)])) {
    const expected = receipts.get(ref),
      observed = statement.actions.find((a) => a.actionRef === ref);
    if (
      !expected ||
      !observed ||
      expected.instrumentId !== observed.instrumentId ||
      expected.currency !== observed.currency ||
      !expected.amount.eq(observed.amount)
    )
      add(
        "action",
        ref,
        expected
          ? expected.instrumentId + " " + expected.currency + " " + money(expected.amount)
          : null,
        observed ? observed.instrumentId + " " + observed.currency + " " + observed.amount : null,
        "Corporate-action receipt identity/amount requires explicit evidence; no entitlement is guessed.",
      );
  }
  return {
    breaks,
    matchedFillIds,
    status: breaks.length ? ("breaks" as const) : ("matched" as const),
    warnings: [
      "Synthetic custodian statement; exact selected-fill references plus declared full custody balances.",
      "Omitted positions/cash represent zero under the declared full-balance scope; missing nonzero balances become breaks.",
      "Pending obligations are not settled custody. Trade-date exposure and economic cash remain in the frozen book.",
      "Corporate-action checks compare evidenced receipts; record-date entitlement inference and withholding rules are not implemented.",
      "Approving a resolution never changes this frozen reconciliation; rerun after correction.",
    ],
  };
}
