import type { Decimal } from "decimal.js";
import type {
  BookSnapshot,
  JournalEntry,
  JournalLine,
  LedgerEvent,
  Account,
  TaxLot,
} from "@portfolio-atlas/contracts";
import { BookDecimal as D, zero, cents, money, quantity, unitCost, invalid } from "./decimal.js";
type Currency = BookSnapshot["cash"][number]["currency"];
interface Lot {
  lotId: string;
  acquisitionEventId: string;
  instrumentId: string;
  currency: Currency;
  acquiredAt: string;
  shares: Decimal;
  cost: Decimal;
}
interface Reservation {
  id: string;
  currency: Currency;
  amount: Decimal;
  createdBy: string;
}
// Reversals remove only the latest active event. Original events remain in storage.
export function activeEvents(events: LedgerEvent[]): LedgerEvent[] {
  const active: LedgerEvent[] = [],
    ids = new Set<string>(),
    references = new Set<string>();
  let previousTime = -Infinity;
  for (const [index, event] of events.entries()) {
    if (event.sequence !== index + 1 || ids.has(event.id) || references.has(event.input.sourceRef))
      invalid("Stored event identity or sequence is inconsistent.");
    if (event.input.portfolioId !== event.portfolioId)
      invalid("Event portfolio references disagree.");
    const time = Date.parse(event.input.occurredAt);
    if (time < previousTime || time > Date.parse(event.recordedAt))
      invalid("Stored event clocks are inconsistent.");
    previousTime = time;
    ids.add(event.id);
    references.add(event.input.sourceRef);
    if (event.input.kind === "reversal") {
      if (active.at(-1)?.id !== event.input.originalEventId)
        invalid("Only the latest active event can be reversed in this chapter.");
      active.pop();
    } else active.push(event);
  }
  return active;
}
export function projectBook(events: LedgerEvent[]) {
  const cash = new Map<Currency, Decimal>(),
    lots: Lot[] = [],
    reservations = new Map<string, Reservation>(),
    reservationIds = new Set<string>();
  const entries: JournalEntry[] = [];
  const balance = (currency: Currency) => cash.get(currency) ?? zero();
  const reserved = (currency: Currency) =>
    [...reservations.values()]
      .filter((row) => row.currency === currency)
      .reduce((sum, row) => sum.plus(row.amount), zero());
  const available = (currency: Currency) => balance(currency).minus(reserved(currency));
  const spend = (currency: Currency, amount: Decimal) => {
    if (amount.gt(available(currency)))
      invalid("Insufficient available cash; reservations cannot be spent twice.");
    cash.set(currency, cents(balance(currency).minus(amount)));
  };
  for (const event of activeEvents(events)) {
    const input = event.input;
    if (input.kind === "reversal") continue;
    const lines: JournalLine[] = [];
    const line = (
      account: Account,
      currency: Currency,
      side: "debit" | "credit",
      amount: Decimal,
    ) => {
      if (amount.isNegative()) invalid("A journal line cannot have a negative amount.");
      if (!amount.isZero()) lines.push({ account, currency, side, amount: money(amount) });
    };
    if (input.kind === "deposit" || input.kind === "dividend") {
      const amount = new D(input.amount);
      cash.set(input.currency, cents(balance(input.currency).plus(amount)));
      line("cash", input.currency, "debit", amount);
      line(
        input.kind === "deposit" ? "contributed_capital" : "dividend_income",
        input.currency,
        "credit",
        amount,
      );
    } else if (input.kind === "withdrawal" || input.kind === "fee") {
      const amount = new D(input.amount);
      spend(input.currency, amount);
      line(
        input.kind === "withdrawal" ? "contributed_capital" : "fee_expense",
        input.currency,
        "debit",
        amount,
      );
      line("cash", input.currency, "credit", amount);
    } else if (input.kind === "reserve") {
      const amount = new D(input.amount);
      if (reservationIds.has(input.reservationId)) invalid("Reservation ID was already used.");
      if (amount.gt(available(input.currency))) invalid("Reservation exceeds available cash.");
      reservationIds.add(input.reservationId);
      reservations.set(input.reservationId, {
        id: input.reservationId,
        currency: input.currency,
        amount,
        createdBy: event.id,
      });
    } else if (input.kind === "release") {
      if (!reservations.delete(input.reservationId))
        invalid("Reservation does not exist or was already consumed.");
    } else if (input.kind === "buy" || input.kind === "sell") {
      const shares = new D(input.quantity),
        gross = cents(shares.mul(input.unitPrice)),
        fee = new D(input.fee);
      if (gross.lte(0)) invalid("Trade notional rounds to zero under the currency policy.");
      if (input.kind === "buy") {
        const total = gross.plus(fee);
        if (input.reservationId) {
          const reservation = reservations.get(input.reservationId);
          if (!reservation || reservation.currency !== input.currency)
            invalid("Purchase reservation is missing or uses another currency.");
          if (total.gt(reservation.amount)) invalid("Whole fill exceeds its cash reservation.");
          reservations.delete(input.reservationId);
        }
        spend(input.currency, total);
        if (
          lots.some(
            (lot) =>
              lot.instrumentId === input.instrumentId &&
              lot.shares.gt(0) &&
              lot.currency !== input.currency,
          )
        )
          invalid("An existing position has a different book currency.");
        lots.push({
          lotId: event.id + ":lot",
          acquisitionEventId: event.id,
          instrumentId: input.instrumentId,
          currency: input.currency,
          acquiredAt: input.occurredAt,
          shares,
          cost: gross,
        });
        line("investment_cost", input.currency, "debit", gross);
        line("fee_expense", input.currency, "debit", fee);
        line("cash", input.currency, "credit", total);
      } else {
        if (input.reservationId)
          invalid("Sell reservations require a later order/settlement policy.");
        if (fee.gt(gross))
          invalid("Sell fee cannot exceed gross proceeds in this teaching policy.");
        const eligible = lots.filter(
          (lot) =>
            lot.instrumentId === input.instrumentId &&
            lot.currency === input.currency &&
            lot.shares.gt(0),
        );
        if (eligible.reduce((sum, lot) => sum.plus(lot.shares), zero()).lt(shares))
          invalid("Insufficient shares; short selling is not supported.");
        let remaining = shares,
          released = zero();
        // FIFO; final disposal consumes every remaining cent rather than rounding it away.
        for (const lot of eligible) {
          if (remaining.isZero()) break;
          const take = remaining.lt(lot.shares) ? remaining : lot.shares;
          const cost = take.eq(lot.shares) ? lot.cost : cents(lot.cost.mul(take).div(lot.shares));
          lot.shares = lot.shares.minus(take);
          lot.cost = lot.cost.minus(cost);
          remaining = remaining.minus(take);
          released = released.plus(cost);
        }
        cash.set(input.currency, cents(balance(input.currency).plus(gross).minus(fee)));
        line("cash", input.currency, "debit", gross.minus(fee));
        line("fee_expense", input.currency, "debit", fee);
        line("investment_cost", input.currency, "credit", released);
        const gain = gross.minus(released);
        line("realized_pnl", input.currency, gain.gte(0) ? "credit" : "debit", gain.abs());
      }
    } else if (input.kind === "split") {
      const ratio = new D(input.ratio),
        affected = lots.filter(
          (lot) => lot.instrumentId === input.instrumentId && lot.shares.gt(0),
        );
      if (ratio.eq(1) || !affected.length)
        invalid("A non-unit split requires an existing position.");
      for (const lot of affected) {
        const changed = lot.shares.mul(ratio);
        quantity(changed);
        lot.shares = changed;
      }
    }
    entries.push({
      id: event.id + ":journal",
      eventId: event.id,
      portfolioId: event.portfolioId,
      sequence: event.sequence,
      kind: lines.length ? "posting" : "memo",
      lines,
    });
  }
  const currencies = new Set<Currency>([
    ...cash.keys(),
    ...[...reservations.values()].map((row) => row.currency),
  ]);
  const lotRows: TaxLot[] = lots.map((lot) => ({
    lotId: lot.lotId,
    acquisitionEventId: lot.acquisitionEventId,
    instrumentId: lot.instrumentId,
    currency: lot.currency,
    acquiredAt: lot.acquiredAt,
    quantityRemaining: quantity(lot.shares),
    costRemaining: money(lot.cost),
    unitCost: unitCost(lot.cost, lot.shares),
  }));
  const positions: BookSnapshot["positions"] = [];
  for (const id of new Set(lots.map((lot) => lot.instrumentId))) {
    const held = lots.filter((lot) => lot.instrumentId === id && lot.shares.gt(0));
    if (!held.length) continue;
    const shares = held.reduce((sum, lot) => sum.plus(lot.shares), zero()),
      cost = held.reduce((sum, lot) => sum.plus(lot.cost), zero());
    positions.push({
      instrumentId: id,
      currency: held[0]!.currency,
      quantity: quantity(shares),
      pendingQuantity: "0.00000000",
      costBasis: money(cost),
      unitCost: unitCost(cost, shares),
    });
  }
  return {
    expectedJournal: entries,
    lots: lotRows,
    positions,
    cash: [...currencies].sort().map((currency) => ({
      currency,
      settled: money(balance(currency)),
      reserved: money(reserved(currency)),
      available: money(available(currency)),
      pending: "0.00",
    })),
    reservations: [...reservations.values()].map((row) => ({
      id: row.id,
      currency: row.currency,
      amount: money(row.amount),
      createdBy: row.createdBy,
    })),
  };
}
export function postingEntry(events: LedgerEvent[], event: LedgerEvent): JournalEntry {
  const entry = projectBook([...events, event]).expectedJournal.find(
    (row) => row.eventId === event.id,
  );
  if (!entry) invalid("A posting event must produce an auditable journal or memo.");
  return entry;
}
export function reversalEntry(original: JournalEntry, event: LedgerEvent): JournalEntry {
  return {
    id: event.id + ":journal",
    eventId: event.id,
    portfolioId: event.portfolioId,
    sequence: event.sequence,
    kind: original.kind,
    lines: original.lines.map((line) => ({
      ...line,
      side: line.side === "debit" ? "credit" : "debit",
    })),
  };
}
