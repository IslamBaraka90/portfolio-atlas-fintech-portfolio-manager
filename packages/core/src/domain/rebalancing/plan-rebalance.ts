import {
  postingInputSchema,
  type BookState,
  type RebalanceRequest,
  type RebalanceProposal,
  type TargetSnapshot,
  type ValuationSnapshot,
  type ProposedTrade,
  type ConstraintSlack,
  type LotSale,
  type MarkEvidence,
  type LedgerEvent,
} from "@portfolio-atlas/contracts";
import {
  BookDecimal as D,
  money,
  quantity,
  signedMoney,
  normalizePosting,
} from "../accounting/decimal.js";
import { postingEntry } from "../accounting/project-book.js";
import { reconcileBook } from "../accounting/reconcile-book.js";
import { valueBook } from "../valuation/value-book.js";
import { ApplicationError } from "../../use-cases/errors.js";
import { evaluateEligibility } from "../instrument-eligibility.js";
import type { LotScoringEngine } from "../../ports/lot-scoring.js";
type Calculation = Omit<
  RebalanceProposal,
  "id" | "revision" | "createdAt" | "expiresAt" | "approvedAt"
>;
const fail = (reason: string): never => {
  throw new ApplicationError("INVALID_SNAPSHOT", reason);
};
export function fifoSale(
  lots: BookState["book"]["lots"],
  instrumentId: string,
  shares: string,
  price: string,
): LotSale[] {
  let remaining = new D(shares);
  const rows: LotSale[] = [];
  for (const lot of lots.filter(
    (l) => l.instrumentId === instrumentId && new D(l.quantityRemaining).gt(0),
  )) {
    if (remaining.eq(0)) break;
    const take = D.min(remaining, lot.quantityRemaining),
      basis = take.eq(lot.quantityRemaining)
        ? new D(lot.costRemaining)
        : new D(lot.costRemaining).mul(take).div(lot.quantityRemaining).toDecimalPlaces(2);
    const gross = new D(take).mul(price).toDecimalPlaces(2);
    rows.push({
      lotId: lot.lotId,
      quantity: quantity(take),
      basisRemoved: money(basis),
      grossProceeds: money(gross),
      gain: signedMoney(gross.minus(basis)),
    });
    remaining = remaining.minus(take);
  }
  if (remaining.gt(0)) fail("Lot sale exceeds remaining shares.");
  return rows;
}
export function planRebalance(
  request: RebalanceRequest,
  target: TargetSnapshot,
  valuation: ValuationSnapshot,
  source: BookState,
  now: string,
  lotScoring?: LotScoringEngine,
): Calculation {
  const nav = new D(valuation.totals.nav ?? 0),
    mandate = target.mandate,
    currency = mandate.baseCurrency;
  if (
    target.status !== "proposal" ||
    !target.weights ||
    nav.lte(0) ||
    valuation.status !== "complete" ||
    !source.book.reconciled
  )
    fail("A successful target, positive complete NAV and reconciled book are required.");
  if (
    valuation.request.portfolioId !== target.request.portfolioId ||
    source.book.portfolioId !== target.request.portfolioId ||
    valuation.baseCurrency !== currency ||
    source.book.checkpoint !== valuation.book.checkpoint
  )
    fail("Portfolio, currency or valuation checkpoint differs.");
  if (
    source.book.cash.some((c) => c.currency !== currency && new D(c.settled).gt(0)) ||
    source.book.positions.some(
      (p) => !target.assetIds.includes(p.instrumentId) || p.currency !== currency,
    )
  )
    fail("The planner requires a complete same-currency target universe.");
  const opening = source.book.cash.find((c) => c.currency === currency);
  const cash = new D(opening?.settled ?? 0),
    reserved = new D(opening?.reserved ?? 0),
    rate = new D(request.feeBps).div(10000);
  const prices = new Map<string, string>(),
    instruments = target.instruments;
  for (const instrument of instruments) {
    if (
      instrument.identityStatus !== "synthetic_verified" ||
      instrument.quoteUnit.currency !== currency ||
      instrument.quoteUnit.scaleToCurrency !== 1 ||
      !instrument.lotSize ||
      instrument.lotSize < 1 ||
      !Number.isInteger(instrument.lotSize) ||
      !instrument.tickSize ||
      !instrument.sector
    )
      fail("Synthetic base-currency whole-lot identity and sector evidence are required.");
    if (evaluateEligibility(instrument, mandate, now).status !== "eligible")
      fail("Current instrument eligibility is not established.");
    const held = valuation.positions.find((p) => p.instrumentId === instrument.instrumentId),
      override = request.newPrices.find((p) => p.instrumentId === instrument.instrumentId);
    if (held && override) fail("Held prices must come from the selected valuation.");
    const price = held?.mark.price ?? override?.price,
      at = held?.mark.quotedAt ?? override?.quotedAt;
    if (
      !price ||
      !at ||
      Date.parse(at) > Date.parse(now) ||
      Date.parse(now) - Date.parse(at) > 3600000
    )
      fail("Every execution mark must be known and at most one hour old.");
    if (override && override.currency !== currency)
      fail("Price currency differs from the portfolio.");
    if (new D(price!).lte(0) || !new D(price!).div(instrument.tickSize!).isInteger())
      fail("Price does not match the evidenced tick.");
    prices.set(instrument.instrumentId, price!);
  }
  if (request.newPrices.some((p) => !target.assetIds.includes(p.instrumentId)))
    fail("New-price evidence must belong to the target.");
  const current = target.assetIds.map((id) =>
    new D(source.book.positions.find((p) => p.instrumentId === id)?.quantity ?? 0)
      .mul(prices.get(id)!)
      .div(nav)
      .toNumber(),
  );
  const maxDrift = Math.max(
    Math.abs(cash.div(nav).toNumber() - target.cashWeight!),
    ...current.map((w, i) => Math.abs(w - target.weights![i]!)),
  );
  const triggered =
    request.trigger === "calendar"
      ? Date.parse(request.dueAt!) <= Date.parse(now)
      : request.trigger === "drift"
        ? maxDrift > request.driftThreshold
        : true;
  const events = structuredClone(source.events),
    journal = structuredClone(source.journal),
    trades: ProposedTrade[] = [];
  const snapshot = () => reconcileBook(source.book.portfolioId, events, journal, now);
  const desired = new Map<string, InstanceType<typeof D>>();
  const alreadyAtRoundedTarget = target.assetIds.every((id, i) => {
    const lot = instruments.find((a) => a.instrumentId === id)!.lotSize!;
    const desiredShares = nav
      .mul(target.weights![i]!)
      .div(prices.get(id)!)
      .div(lot)
      .floor()
      .mul(lot);
    return desiredShares.eq(
      source.book.positions.find((p) => p.instrumentId === id)?.quantity ?? 0,
    );
  });
  // No fee is incurred when the raw target needs no trade. Do not manufacture turnover.
  const buffered = alreadyAtRoundedTarget ? nav : nav.mul(new D(1).minus(rate.mul(2)));
  for (const [i, id] of target.assetIds.entries()) {
    const lot = instruments.find((a) => a.instrumentId === id)!.lotSize!;
    desired.set(
      id,
      buffered.mul(target.weights![i]!).div(prices.get(id)!).div(lot).floor().mul(lot),
    );
  }
  let sales = new D(0),
    purchases = new D(0),
    fees = new D(0);
  function add(side: "buy" | "sell", id: string, shares: InstanceType<typeof D>) {
    const price = prices.get(id)!,
      gross = new D(shares).mul(price).toDecimalPlaces(2);
    if (shares.lte(0) || gross.lt(request.minTrade) || gross.eq(0)) return;
    const instrument = instruments.find((i) => i.instrumentId === id)!,
      state = snapshot(),
      fee = money(gross.mul(rate));
    const lots = side === "sell" ? fifoSale(state.lots, id, quantity(shares), price) : [];
    const input = normalizePosting(
      postingInputSchema.parse({
        kind: side,
        portfolioId: source.book.portfolioId,
        sourceRef: "proposal-" + source.book.checkpoint + "-" + (trades.length + 1),
        occurredAt: now,
        instrumentId: id,
        instrumentRevision: instrument.revision,
        currency: currency,
        quantity: quantity(shares),
        unitPrice: price,
        fee,
      }),
    );
    const event: LedgerEvent = {
      id: "proposal-event-" + events.length,
      portfolioId: source.book.portfolioId,
      sequence: events.length + 1,
      recordedAt: now,
      instrumentSnapshot: instrument,
      input,
    };
    journal.push(postingEntry(events, event));
    events.push(event);
    trades.push({
      instrumentId: id,
      instrumentRevision: instrument.revision,
      side,
      quantity: quantity(shares),
      price,
      notional: money(gross),
      fee,
      reason:
        side === "sell"
          ? "Reduce above-target quantity before funding buys."
          : "Use available cash after reserve, costs and lot rounding.",
      lots,
      lotScore:
        side === "sell" && lotScoring
          ? lotScoring.compare(
              id,
              price,
              quantity(shares),
              state.lots,
              now,
              request.illustrativeCoefficient,
            )
          : null,
    });
    if (side === "sell") sales = sales.plus(gross);
    else purchases = purchases.plus(gross);
    fees = fees.plus(fee);
  }
  const ids = [...target.assetIds].sort();
  if (triggered && request.trigger !== "cash_flow")
    for (const id of ids) {
      const lot = instruments.find((i) => i.instrumentId === id)!.lotSize!,
        held = new D(snapshot().positions.find((p) => p.instrumentId === id)?.quantity ?? 0);
      add(
        "sell",
        id,
        D.max(0, held.minus(desired.get(id)!))
          .div(lot)
          .floor()
          .mul(lot),
      );
    }
  if (triggered)
    for (const id of ids) {
      const state = snapshot(),
        lot = instruments.find((i) => i.instrumentId === id)!.lotSize!,
        held = new D(state.positions.find((p) => p.instrumentId === id)?.quantity ?? 0);
      // Protect a starting-NAV cash reserve, which is conservative after expensed fees.
      const spendable = D.max(
        0,
        new D(state.cash.find((c) => c.currency === currency)?.available ?? 0).minus(
          nav.mul(mandate.minCashWeight),
        ),
      );
      const affordable = spendable
        .div(new D(prices.get(id)!).mul(new D(1).plus(rate)))
        .div(lot)
        .floor()
        .mul(lot);
      add(
        "buy",
        id,
        D.min(D.max(0, desired.get(id)!.minus(held)), affordable)
          .div(lot)
          .floor()
          .mul(lot),
      );
    }
  const projected = snapshot();
  const marks: MarkEvidence[] = projected.positions.map((p) => ({
    instrumentId: p.instrumentId,
    currency: currency,
    price: prices.get(p.instrumentId)!,
    status: "accepted",
    quotedAt: now,
    observedAt: now,
    dataset: null,
    rowId: null,
    sourceHash: null,
    reviewId: null,
    override: null,
    reasons: ["Frozen rebalance teaching mark; original evidence retained in proposal."],
  }));
  const values = valueBook(
    { events, journal, book: projected },
    {
      portfolioId: source.book.portfolioId,
      checkpoint: events.length,
      asOf: now,
      maxPriceAgeSeconds: 3600,
      prices: [],
      overrides: [],
      fxRuns: [],
    },
    currency,
    marks,
    [],
  );
  const postNav = new D(values.totals.nav!),
    closing = new D(projected.cash.find((c) => c.currency === currency)?.settled ?? 0);
  const allocations = target.assetIds.map((id, i) => {
    const after = projected.positions.find((p) => p.instrumentId === id)?.quantity ?? "0.00000000";
    const weight = new D(after).mul(prices.get(id)!).div(postNav).toNumber();
    return {
      instrumentId: id,
      price: prices.get(id)!,
      beforeQuantity:
        source.book.positions.find((p) => p.instrumentId === id)?.quantity ?? "0.00000000",
      afterQuantity: after,
      currentWeight: current[i]!,
      targetWeight: target.weights![i]!,
      projectedWeight: weight,
      residualDrift: weight - target.weights![i]!,
    };
  });
  const constraints: ConstraintSlack[] = [];
  const audit = (rule: string, subject: string, observed: number, limit: number, min = false) => {
    const slack = min ? observed - limit : limit - observed;
    constraints.push({
      rule,
      subject,
      observed,
      limit,
      slack,
      status: slack >= -1e-10 ? "pass" : "fail",
      explanation:
        "Checked on exact post-fee quantities; display rounding does not change the rule.",
    });
  };
  const cashWeight = closing.div(postNav).toNumber(),
    available = closing.minus(reserved);
  audit(
    "CASH_MINIMUM",
    "Available cash / NAV",
    available.div(postNav).toNumber(),
    mandate.minCashWeight,
    true,
  );
  audit("CASH_MAXIMUM", "Settled cash / NAV", cashWeight, mandate.maxCashWeight);
  const sectors = new Map<string, number>();
  for (const a of allocations) {
    audit("POSITION_LIMIT", a.instrumentId, a.projectedWeight, mandate.maxPositionWeight);
    const sector = instruments.find((i) => i.instrumentId === a.instrumentId)!.sector!;
    sectors.set(sector, (sectors.get(sector) ?? 0) + a.projectedWeight);
  }
  for (const [sector, weight] of sectors)
    audit("SECTOR_LIMIT", sector, weight, mandate.maxSectorWeight);
  audit(
    "COST_LIMIT",
    "Fees / starting NAV",
    fees.div(nav).toNumber(),
    target.request.maxCostFraction,
  );
  const turnover =
    0.5 *
    (allocations.reduce((sum, a) => sum + Math.abs(a.projectedWeight - a.currentWeight), 0) +
      Math.abs(cashWeight - cash.div(nav).toNumber()));
  audit("TURNOVER", "Half-L1 including cash", turnover, target.request.turnoverCap);
  const failures = constraints.filter((c) => c.status !== "pass");
  return {
    portfolioId: source.book.portfolioId,
    request,
    target,
    valuation,
    status: !triggered || !trades.length ? "no_trade" : failures.length ? "rejected" : "ready",
    reasons: [
      ...(!triggered ? ["Trigger is not due or drift is within threshold."] : []),
      ...failures.map((f) => f.rule + ": " + f.subject),
    ],
    warnings: [
      "Deterministic greedy sizing, not optimal trade selection.",
      "Immediate teaching settlement funds buys from sells; delayed settlement requires separate controls.",
      "FIFO is the executable book policy. Illustrative lot scores are not tax or cash.",
      "Whole lots, minimum trades and conservative fee buffer leave residual drift.",
    ],
    triggered,
    trades,
    projectedBook: projected,
    cashBridge: {
      opening: money(cash),
      sales: money(sales),
      purchases: money(purchases),
      fees: money(fees),
      closing: money(closing),
      reserved: money(reserved),
      available: money(available),
    },
    startingNav: money(nav),
    projectedNav: money(postNav),
    allocations,
    cashWeight,
    constraints,
    policyVersion: "chapter-11.v1",
    createsOrders: false,
  };
}
