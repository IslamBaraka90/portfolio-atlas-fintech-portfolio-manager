import type { SettlementService } from "./settlement-service.js";
import { settlementDueDate } from "../domain/settlement/due-date.js";
import {
  paperSubmitSchema,
  paperBatchSchema,
  paperEventSchema,
  type PaperSubmit,
  type PaperEvent,
  type PaperBatch,
  type PaperOrder,
  type PostingInput,
} from "@portfolio-atlas/contracts";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { PaperExecutionAnalytics } from "../ports/paper-execution.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { RebalanceService } from "./rebalance-service.js";
import type { LedgerService } from "./ledger-service.js";
import type { PortfolioService } from "./portfolio-service.js";
import type { InstrumentService } from "./instrument-service.js";
import { Commands, canonical, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
import { BookDecimal as D, money, quantity } from "../domain/accounting/decimal.js";
const terminal = (order: PaperOrder) => ["filled", "cancelled", "rejected"].includes(order.state);
const invalid = (reason: string): never => {
  throw new ApplicationError("INVALID_EVENT", reason);
};
export class PaperExecutionService {
  constructor(
    private store: SnapshotRepository,
    private rebalances: RebalanceService,
    private ledger: LedgerService,
    private portfolios: PortfolioService,
    private instruments: InstrumentService,
    private analytics: PaperExecutionAnalytics,
    private settlements: SettlementService,
    private clock: Clock,
    private ids: IdFactory,
    private commands: Commands,
  ) {}
  list() {
    return this.store.all("paper-batch").map((v) => paperBatchSchema.parse(v));
  }
  get(id: string) {
    const value = this.store.get("paper-batch", id);
    if (!value) throw new ApplicationError("NOT_FOUND", "Paper batch not found.");
    return paperBatchSchema.parse(value);
  }
  assertManualWriteAllowed(portfolioId: string) {
    if (this.list().some((b) => b.portfolioId === portfolioId && b.status === "active"))
      invalid("An active paper batch locks manual book writes. Finish or cancel its orders first.");
  }
  private currentPolicy(batch: PaperBatch, order: PaperOrder) {
    const mandate = this.portfolios.getMandate(batch.proposal.target.mandate.id),
      instrument = this.instruments.get(order.instrumentId);
    if (
      mandate.revision !== batch.proposal.target.mandate.revision ||
      instrument.revision !== order.instrumentRevision
    )
      invalid("Mandate or instrument changed; cancel remaining orders and rebuild.");
    if (
      Date.parse(this.clock.now()) >= Date.parse(batch.proposal.expiresAt) ||
      [
        ...batch.proposal.valuation.positions.map((p) => p.mark.quotedAt),
        ...batch.proposal.request.newPrices.map((p) => p.quotedAt),
      ].some((at) => !at || Date.parse(this.clock.now()) - Date.parse(at) > 3600000)
    )
      invalid("Approved proposal expired; cancel remaining orders and rebuild.");
  }
  submit(value: PaperSubmit, context: CommandContext) {
    const request = paperSubmitSchema.parse(value);
    return this.commands.executeSync("paper.submit", request, context, () => {
      const existing = this.list().find((b) => b.clientBatchId === request.clientBatchId);
      if (existing) {
        if (
          existing.proposal.id !== request.proposal.id ||
          existing.proposal.revision !== request.proposal.revision ||
          existing.orders.some((o) => o.orderType !== request.orderType) ||
          (existing.settlementPolicy?.id ?? null) !== (request.settlementPolicy?.id ?? null) ||
          (existing.settlementPolicy?.revision ?? null) !==
            (request.settlementPolicy?.revision ?? null)
        )
          throw new ApplicationError(
            "IDEMPOTENCY_CONFLICT",
            "Client batch ID already has different terms.",
          );
        return existing;
      }
      const proposal = this.rebalances.get(request.proposal.id);
      if (proposal.revision !== request.proposal.revision || proposal.status !== "approved")
        invalid("The exact approved proposal revision is required.");
      if (this.list().some((b) => b.proposal.id === proposal.id))
        invalid("This approved proposal was already submitted.");
      this.assertManualWriteAllowed(proposal.portfolioId);
      const book = this.rebalances.assertFresh(proposal),
        now = this.clock.now();
      const orders: PaperOrder[] = proposal.trades.map((trade, index) => {
        const instrument = proposal.target.instruments.find(
          (i) => i.instrumentId === trade.instrumentId,
        )!;
        if (
          !new D(trade.quantity).isInteger() ||
          new D(trade.quantity).gt(1000000) ||
          new D(trade.price).gt(10000000)
        )
          invalid(
            "Paper execution supports at most one million whole shares and price 10,000,000.",
          );
        const tick = this.analytics.tick(trade.price, instrument.tickSize!);
        if (!tick.valid) invalid(tick.reason);
        return {
          id: this.ids.next(),
          clientOrderId: request.clientBatchId + "-" + index,
          tradeIndex: index,
          instrumentId: trade.instrumentId,
          instrumentRevision: trade.instrumentRevision,
          side: trade.side,
          orderType: request.orderType,
          quantity: trade.quantity,
          protectionPrice: trade.price,
          lotSize: instrument.lotSize!,
          tickSize: instrument.tickSize!,
          state: "submitted",
          submittedAt: now,
          acceptedAt: null,
          lastOpeningAt: null,
          filledQuantity: "0.00000000",
          remainingQuantity: trade.quantity,
          filledNotional: "0.00",
          fees: "0.00",
          averagePrice: null,
          cashReserved: "0.00",
          reservationId: null,
          sharesCommitted: "0.00000000",
          fills: [],
          checks: [
            "Exact approved proposal; current book, valuation, mandate and instrument revisions checked.",
            "Tick: " + tick.reason,
            "Portfolio locked against manual book mutations while batch is active.",
          ],
          history: [
            {
              eventId: request.clientBatchId,
              at: now,
              kind: "submit",
              state: "submitted",
              reason: "Awaiting explicit synthetic broker acceptance.",
            },
          ],
        };
      });
      const settlementPolicy = request.settlementPolicy
        ? this.settlements.policy(request.settlementPolicy.id, request.settlementPolicy.revision)
        : null;
      if (settlementPolicy) settlementDueDate(now.slice(0, 10), settlementPolicy);
      const result = paperBatchSchema.parse({
        id: this.ids.next(),
        revision: 1,
        clientBatchId: request.clientBatchId,
        portfolioId: proposal.portfolioId,
        createdAt: now,
        updatedAt: now,
        proposal,
        settlementPolicy,
        expectedBookCheckpoint: book.book.checkpoint,
        status: "active",
        orders,
        warnings: [
          "Paper only; authored opening prices and capacities, no observed broker or market fills.",
          "Daily-bar high/low cannot establish intrabar order or queue priority.",
          "Protected market orders reject openings beyond proposal protection; limit orders wait.",
          "Partial execution is transitional; final mandate compliance is not asserted.",
          settlementPolicy
            ? "Deferred teaching settlement: obligations protect cash until explicit custody acknowledgment."
            : "Immediate teaching settlement; these fills are already cash-settled.",
        ],
        policyVersion: "chapter-12.v1",
        packageVersion: "0.13.2",
      });
      this.store.append("paper-batch", result.id, 1, result);
      return result;
    });
  }
  private post(batch: PaperBatch, eventId: string, suffix: string, value: object) {
    return this.ledger.postWithinTransaction({
      portfolioId: batch.portfolioId,
      occurredAt: this.clock.now(),
      sourceRef: "paper-" + eventId + "-" + suffix,
      ...value,
    } as PostingInput);
  }
  private reserve(batch: PaperBatch, order: PaperOrder, eventId: string) {
    if (order.side === "sell") {
      const held = this.ledger
        .get(batch.portfolioId)
        .book.positions.find((p) => p.instrumentId === order.instrumentId);
      if (new D(held?.quantity ?? 0).lt(order.remainingQuantity))
        invalid("Sell commitment exceeds currently held shares.");
      order.sharesCommitted = order.remainingQuantity;
      return;
    }
    const gross = new D(order.remainingQuantity).mul(order.protectionPrice).toDecimalPlaces(2);
    const feeBound = new D(order.filledNotional)
      .plus(gross)
      .mul(batch.proposal.request.feeBps)
      .div(10000)
      .toDecimalPlaces(2)
      .minus(order.fees);
    const amount = money(gross.plus(D.max(0, feeBound)).plus(".01")),
      book = this.ledger.get(batch.portfolioId).book;
    const available = new D(
      book.cash.find((c) => c.currency === batch.proposal.target.currency)?.available ?? 0,
    );
    const floor = new D(batch.proposal.projectedNav).mul(
      batch.proposal.target.mandate.minCashWeight,
    );
    if (available.minus(amount).lt(floor))
      invalid(
        "Current cash cannot fund this reservation while protecting the mandate floor. Complete funding sells first.",
      );
    order.reservationId = "paper-" + order.id + "-" + (order.history.length + 1);
    this.post(batch, eventId, "reserve", {
      kind: "reserve",
      currency: batch.proposal.target.currency,
      reservationId: order.reservationId,
      amount,
    });
    order.cashReserved = amount;
  }
  private release(batch: PaperBatch, order: PaperOrder, eventId: string) {
    if (order.reservationId)
      this.post(batch, eventId, "release", { kind: "release", reservationId: order.reservationId });
    order.reservationId = null;
    order.cashReserved = "0.00";
    order.sharesCommitted = "0.00000000";
  }
  private opening(batch: PaperBatch, order: PaperOrder, request: PaperEvent): string {
    if (
      !["accepted", "partially_filled", "cancel_pending"].includes(order.state) ||
      !order.acceptedAt
    )
      invalid("Only an accepted live order can receive an opening fill.");
    this.currentPolicy(batch, order);
    const opening = request.opening!;
    const time = Date.parse(opening.at);
    if (
      time <= Date.parse(order.acceptedAt!) ||
      time > Date.parse(this.clock.now()) ||
      (order.lastOpeningAt !== null && Date.parse(order.lastOpeningAt) >= time)
    )
      invalid("Opening time must follow acceptance and prior fills, and cannot be future.");
    const price = new D(opening.price),
      reference = new D(order.protectionPrice);
    const tick = this.analytics.tick(opening.price, order.tickSize);
    if (!tick.valid) invalid(tick.reason);
    if (price.minus(reference).abs().div(reference).gt(".05"))
      invalid("Authored opening is outside the 5% reference band.");
    order.lastOpeningAt = opening.at;
    const protectedPrice = order.side === "buy" ? price.lte(reference) : price.gte(reference);
    if (!protectedPrice) {
      if (order.orderType === "limit")
        return "No fill: opening price did not cross the limit. Intrabar touches are not inferred.";
      this.release(batch, order, request.eventId);
      order.state = "rejected";
      return "Protected market order rejected: opening exceeded the approved price protection.";
    }
    const shares = D.min(order.remainingQuantity, opening.capacity)
      .div(order.lotSize)
      .floor()
      .mul(order.lotSize);
    if (shares.eq(0)) return "No fill: authored opening capacity is below one executable lot.";
    const notional = shares.mul(price).toDecimalPlaces(2);
    const cumulativeNotional = new D(order.filledNotional).plus(notional);
    const cumulativeFee = cumulativeNotional
      .mul(batch.proposal.request.feeBps)
      .div(10000)
      .toDecimalPlaces(2);
    const fee = cumulativeFee.minus(order.fees);
    const cancelPending = order.state === "cancel_pending";
    const fillId = this.ids.next();
    if (batch.settlementPolicy && opening.at.slice(0, 10) !== this.clock.now().slice(0, 10))
      invalid("Deferred paper opening must belong to the current UTC teaching trade date.");
    const dueDate = batch.settlementPolicy
      ? settlementDueDate(opening.at.slice(0, 10), batch.settlementPolicy)
      : null;
    this.release(batch, order, request.eventId);
    const posted = this.post(batch, request.eventId, "fill", {
      kind: batch.settlementPolicy
        ? order.side === "buy"
          ? "pending_buy"
          : "pending_sell"
        : order.side,
      ...(batch.settlementPolicy
        ? {
            settlementId: fillId,
            dueDate: dueDate!,
            calendarId: batch.settlementPolicy.id,
            calendarRevision: batch.settlementPolicy.revision,
          }
        : {}),
      instrumentId: order.instrumentId,
      instrumentRevision: order.instrumentRevision,
      currency: batch.proposal.target.currency,
      quantity: quantity(shares),
      unitPrice: opening.price,
      fee: money(fee),
    });
    const ledgerEvent = posted.events.find(
      (e) => e.input.sourceRef === "paper-" + request.eventId + "-fill",
    )!;
    order.fills.push({
      id: fillId,
      eventId: request.eventId,
      at: opening.at,
      recordedAt: this.clock.now(),
      quantity: quantity(shares),
      price: opening.price,
      notional: money(notional),
      fee: money(fee),
      ledgerEventId: ledgerEvent.id,
      source: "authored_paper_opening_event",
      settlementPolicy: batch.settlementPolicy ? "deferred_teaching" : "immediate_teaching",
      settlementId: batch.settlementPolicy ? fillId : null,
      dueDate,
    });
    const result = this.analytics.residual(order.quantity, order.fills);
    order.filledQuantity = quantity(new D(result.filled));
    order.remainingQuantity = quantity(new D(result.remaining));
    order.averagePrice = result.averagePrice;
    order.filledNotional = money(cumulativeNotional);
    order.fees = money(cumulativeFee);
    if (result.remaining === 0) order.state = "filled";
    else {
      this.reserve(batch, order, request.eventId);
      order.state = cancelPending ? "cancel_pending" : "partially_filled";
    }
    return (
      "Authored opening filled " +
      shares.toFixed() +
      "; cumulative fee " +
      order.fees +
      ". Existing journal posted once."
    );
  }
  apply(id: string, value: PaperEvent, context: CommandContext) {
    const request = paperEventSchema.parse(value);
    return this.commands.executeSync("paper.event", { id, request }, context, () => {
      const saved = this.store.get("paper-event", request.eventId, 1) as
        { fingerprint: string; result: PaperBatch } | undefined;
      const fingerprint = canonical({ id, request });
      if (saved) {
        if (saved.fingerprint !== fingerprint)
          throw new ApplicationError("IDEMPOTENCY_CONFLICT", "Paper event ID has different terms.");
        return saved.result;
      }
      const batch = this.get(id),
        order = batch.orders.find((o) => o.id === request.orderId);
      if (!order) throw new ApplicationError("NOT_FOUND", "Order does not belong to this batch.");
      if (batch.revision !== request.expectedRevision)
        throw new ApplicationError("REVISION_CONFLICT", "Paper batch revision changed.");
      const book = this.ledger.get(batch.portfolioId);
      if (book.book.checkpoint !== batch.expectedBookCheckpoint || !book.book.reconciled)
        invalid("Book changed outside the paper batch or failed reconciliation.");
      let reason = request.reason;
      if (request.kind === "accept") {
        if (order.state !== "submitted") invalid("Only submitted orders can be accepted.");
        this.currentPolicy(batch, order);
        this.reserve(batch, order, request.eventId);
        order.state = "accepted";
        order.acceptedAt = this.clock.now();
        reason = "Resources committed atomically.";
      } else if (request.kind === "cancel_request") {
        if (terminal(order) || order.state === "cancel_pending")
          invalid("This order cannot enter cancel-pending.");
        order.state = "cancel_pending";
        reason = "Cancellation requested; resources remain committed until acknowledgment.";
      } else if (request.kind === "cancel_ack") {
        if (order.state === "filled")
          reason = "Fill completed before cancel acknowledgment; no resource or trade reversal.";
        else {
          if (order.state !== "cancel_pending") invalid("Cancellation requires a pending request.");
          this.release(batch, order, request.eventId);
          order.state = "cancelled";
          reason = "Cancellation acknowledged; remaining resources released.";
        }
      } else if (request.kind === "reject") {
        if (terminal(order)) invalid("Terminal orders cannot be rejected.");
        this.release(batch, order, request.eventId);
        order.state = "rejected";
        reason = reason || "Synthetic broker rejected remaining quantity.";
      } else reason = this.opening(batch, order, request);
      order.history.push({
        eventId: request.eventId,
        at: this.clock.now(),
        kind: request.kind,
        state: order.state,
        reason,
      });
      batch.revision++;
      batch.updatedAt = this.clock.now();
      batch.expectedBookCheckpoint = this.ledger.get(batch.portfolioId).book.checkpoint;
      batch.status = batch.orders.every(terminal) ? "complete" : "active";
      const result = paperBatchSchema.parse(batch);
      this.store.append("paper-batch", id, result.revision, result);
      this.store.append("paper-event", request.eventId, 1, { fingerprint, result });
      return result;
    });
  }
}
