import type {
  ActionReview,
  BookState,
  MarketDataset,
  MarkEvidence,
  ValuationRequest,
} from "@portfolio-atlas/contracts";
import { BookDecimal as D, quantity } from "../accounting/decimal.js";
import { activeEvents } from "../accounting/project-book.js";
import { selectActions } from "../select-actions.js";
type Position = BookState["book"]["positions"][number];
export function selectMark(
  position: Position,
  book: BookState,
  request: ValuationRequest,
  recordedAt: string,
  dataset?: MarketDataset,
  review?: ActionReview,
): MarkEvidence {
  const choice = request.prices.find((p) => p.instrumentId === position.instrumentId);
  const override = request.overrides.find((p) => p.instrumentId === position.instrumentId);
  const mark: MarkEvidence = {
    instrumentId: position.instrumentId,
    currency: position.currency,
    price: null,
    status: "unavailable",
    quotedAt: null,
    observedAt: null,
    dataset: choice?.dataset ?? null,
    rowId: choice?.rowId ?? null,
    sourceHash: dataset?.sourceHash ?? null,
    reviewId: review?.id ?? null,
    override: override ?? null,
    reasons: [],
  };
  const at = Date.parse(request.asOf);
  const checkTime = (quotedAt: string) => {
    const quoted = Date.parse(quotedAt);
    if (!Number.isFinite(quoted) || quoted > at)
      mark.reasons.push("Price quote is invalid or later than the valuation cutoff.");
    else if (at - quoted > request.maxPriceAgeSeconds * 1000)
      mark.reasons.push("Price is stale under the selected freshness budget.");
  };
  if (override) {
    mark.quotedAt = override.quotedAt;
    mark.observedAt = recordedAt;
    checkTime(override.quotedAt);
    if (override.currency !== position.currency)
      mark.reasons.push("Override currency disagrees with the book.");
    if (!mark.reasons.length) {
      mark.price = quantity(new D(override.price));
      mark.status = "overridden";
    }
    return mark;
  }
  if (!choice || !dataset || !review) {
    mark.reasons.push("An accepted price and matching action review are required.");
    return mark;
  }
  if (
    dataset.instrument.instrumentId !== position.instrumentId ||
    review.datasetId !== dataset.id ||
    review.datasetRevision !== dataset.revision ||
    review.sourceHash !== dataset.sourceHash
  ) {
    mark.reasons.push("Price, identity and action-review references disagree.");
    return mark;
  }
  if (dataset.source !== "synthetic" || dataset.basis !== "synthetic_unadjusted")
    mark.reasons.push(
      "Automatic valuation requires known unadjusted price and corporate-action coverage.",
    );
  if (
    dataset.quoteUnit.currency !== position.currency ||
    dataset.quoteUnit.scaleToCurrency === null
  )
    mark.reasons.push("Price units or currency disagree with the book.");
  if (Date.parse(dataset.observedAt) > at || Date.parse(review.createdAt) > at)
    mark.reasons.push("Source evidence was recorded after the requested cutoff.");
  const index = dataset.rows.findIndex((row) => row.rowId === choice.rowId),
    row = dataset.rows[index];
  if (
    !row ||
    !dataset.quality.acceptedIndexes.includes(index) ||
    row.close === null ||
    !row.timestamp
  ) {
    mark.reasons.push("Selected source row is absent or quarantined.");
    return mark;
  }
  mark.quotedAt = row.timestamp;
  mark.observedAt = dataset.observedAt;
  checkTime(row.timestamp);
  const active = activeEvents(book.events);
  const splits = active.filter(
    (e) => e.input.kind === "split" && e.input.instrumentId === position.instrumentId,
  );
  const actions = selectActions(review.actions, request.asOf).selected.filter(
    (a) =>
      a.kind === "split" &&
      a.effectiveDate !== null &&
      a.effectiveDate <= request.asOf.slice(0, 10),
  );
  const openLots = book.book.lots.filter(
    (l) => l.instrumentId === position.instrumentId && new D(l.quantityRemaining).gt(0),
  );
  for (const action of actions) {
    const ownsBefore = openLots.some(
      (l) => Date.parse(l.acquiredAt) < Date.parse(action.effectiveDate! + "T00:00:00Z"),
    );
    if (!ownsBefore) continue;
    const matching = splits.filter(
      (e) =>
        e.input.kind === "split" &&
        e.input.evidenceRef === action.id &&
        e.input.occurredAt.slice(0, 10) === action.effectiveDate &&
        action.ratio !== null &&
        new D(e.input.ratio).eq(action.ratio),
    );
    if (action.status !== "confirmed" || matching.length !== 1)
      mark.reasons.push("Known split requires one matching book posting: " + action.id);
  }
  for (const event of splits) {
    const input = event.input;
    if (Date.parse(event.input.occurredAt) > Date.parse(row.timestamp))
      mark.reasons.push("The selected price predates a book split and uses different share units.");
    if (input.kind === "split" && !actions.some((a) => a.id === input.evidenceRef))
      mark.reasons.push("A book split is unexplained by the selected price history.");
  }
  if (!mark.reasons.length) {
    mark.price = quantity(
      new D(row.close.toString()).mul(dataset.quoteUnit.scaleToCurrency!.toString()),
    );
    mark.status = "accepted";
  }
  return mark;
}
