import assert from "node:assert/strict";
import test from "node:test";
import {
  postingInputSchema,
  valuationRequestSchema,
  type LedgerEvent,
  type JournalEntry,
  type BookState,
  type MarketDataset,
  type ActionReview,
} from "@portfolio-atlas/contracts";
import { fixtureTime, syntheticInstruments } from "@portfolio-atlas/testing";
import { postingEntry } from "../src/domain/accounting/project-book.js";
import { reconcileBook } from "../src/domain/accounting/reconcile-book.js";
import { normalizePosting } from "../src/domain/accounting/decimal.js";
import { selectMark } from "../src/domain/valuation/select-mark.js";
import { valueBook } from "../src/domain/valuation/value-book.js";
function fixture() {
  const instrument = syntheticInstruments[0]!,
    events: LedgerEvent[] = [],
    journal: JournalEntry[] = [];
  function post(value: object) {
    const input = normalizePosting(
      postingInputSchema.parse({
        portfolioId: "p",
        sourceRef: "source-" + events.length,
        occurredAt: "2026-09-01T00:00:00Z",
        ...value,
      }),
    );
    const event: LedgerEvent = {
      id: "event-" + events.length,
      portfolioId: "p",
      sequence: events.length + 1,
      recordedAt: fixtureTime,
      instrumentSnapshot: "instrumentId" in input ? instrument : null,
      input,
    };
    journal.push(postingEntry(events, event));
    events.push(event);
  }
  const asset = { instrumentId: instrument.instrumentId, instrumentRevision: 1, currency: "USD" };
  post({ kind: "deposit", currency: "USD", amount: "10000" });
  post({ kind: "buy", ...asset, quantity: "10", unitPrice: "100", fee: "5" });
  const book = (): BookState => ({
    events,
    journal,
    book: reconcileBook("p", events, journal, fixtureTime),
  });
  const row = {
    rowId: "row-110",
    sourceIndex: 0,
    symbol: "AURA",
    timestamp: "2026-09-15T20:00:00Z",
    sessionDate: "2026-09-15",
    open: 109,
    high: 111,
    low: 108,
    close: 110,
    volume: 1000,
    adjustedClose: null,
    finality: "final" as const,
    evidence: "authored valuation lesson",
  };
  const dataset: MarketDataset = {
    id: "data",
    revision: 1,
    createdAt: fixtureTime,
    instrument,
    request: {
      instrumentId: instrument.instrumentId,
      instrumentRevision: 1,
      from: "2026-09-15",
      to: "2026-09-16",
      scenario: "clean",
    },
    source: "synthetic",
    observedAt: fixtureTime,
    cache: "fresh",
    sourceHash: "a".repeat(64),
    archiveRef: "lesson",
    interval: "1d",
    timezone: instrument.timezone,
    quoteUnit: instrument.quoteUnit,
    basis: "synthetic_unadjusted",
    availability: "observed_now_not_historical",
    rows: [row],
    quality: {
      policyVersion: "chapter-3.v1",
      acceptedIndexes: [0],
      quarantinedIndexes: [],
      rows: [{ index: 0, rowId: row.rowId, accepted: true, findings: [] }],
      coverage: {
        expectedSessions: 1,
        observedSessions: 1,
        missingSessions: [],
        evidence: "authored",
      },
      warnings: [],
    },
  };
  const review: ActionReview = {
    id: "review",
    createdAt: fixtureTime,
    datasetId: "data",
    datasetRevision: 1,
    sourceHash: dataset.sourceHash,
    actions: [],
    warnings: [],
  };
  const request = valuationRequestSchema.parse({
    portfolioId: "p",
    checkpoint: 2,
    asOf: fixtureTime,
    prices: [
      {
        instrumentId: instrument.instrumentId,
        dataset: { id: "data", revision: 1 },
        rowId: row.rowId,
        reviewId: "review",
      },
    ],
  });
  const mark = () =>
    selectMark(book().book.positions[0]!, book(), request, fixtureTime, dataset, review);
  return { post, asset, book, dataset, review, request, mark };
}
test("NAV is 10,095; a 500 external deposit changes NAV and capital by 500, not investment profit", () => {
  const f = fixture(),
    state = f.book();
  const result = valueBook(state, f.request, "USD", [f.mark()], []);
  assert.equal(result.totals.nav, "10095.00");
  assert.equal(result.externalCapital[0]!.netContributed, "10000.00");
  f.post({ kind: "deposit", currency: "USD", amount: "500" });
  const after = valueBook(f.book(), f.request, "USD", [f.mark()], []);
  assert.equal(after.totals.nav, "10595.00");
  assert.equal(after.externalCapital[0]!.netContributed, "10500.00");
  assert.equal(after.positions[0]!.marketValueLocal, "1100.00");
  assert.deepEqual(valueBook(state, f.request, "USD", [f.mark()], []).totals, result.totals);
});
test("missing and stale prices/FX remain null instead of manufacturing complete NAV", () => {
  const f = fixture();
  f.request.maxPriceAgeSeconds = 3600;
  const stale = f.mark();
  assert.equal(stale.status, "unavailable");
  assert.match(stale.reasons.join(" "), /stale/);
  assert.equal(valueBook(f.book(), f.request, "USD", [stale], []).totals.nav, null);
  f.request.maxPriceAgeSeconds = 864000;
  f.post({ kind: "deposit", currency: "EUR", amount: "90" });
  const missing = valueBook(f.book(), f.request, "USD", [f.mark()], []);
  assert.equal(missing.status, "incomplete");
  assert.equal(missing.cash.find((c) => c.currency === "EUR")!.baseAmount, null);
  const fx = {
    id: "fx",
    baseCurrency: "USD",
    quoteCurrency: "EUR",
    quotePerBase: 0.9,
    observedAt: fixtureTime,
    availableAt: fixtureTime,
    source: "authored",
    maxAgeSeconds: 3600,
  };
  assert.equal(valueBook(f.book(), f.request, "USD", [f.mark()], [fx]).totals.nav, "10195.00");
  assert.equal(
    valueBook(
      f.book(),
      f.request,
      "USD",
      [f.mark()],
      [{ ...fx, observedAt: "2026-09-01T00:00:00Z" }],
    ).status,
    "incomplete",
  );
  f.post({ kind: "withdrawal", currency: "EUR", amount: "90" });
  assert.equal(valueBook(f.book(), f.request, "USD", [f.mark()], []).totals.nav, "10095.00");
});
test("action evidence must match book share units; overrides retain their own explicit evidence", () => {
  const f = fixture();
  f.review.actions.push({
    id: "split-lesson",
    revision: 1,
    instrumentId: f.asset.instrumentId,
    kind: "split",
    status: "confirmed",
    effectiveDate: "2026-09-03",
    availableAt: "2026-08-25T00:00:00Z",
    observedAt: fixtureTime,
    source: "synthetic",
    sourceRef: "lesson",
    ratio: 2,
    amount: null,
    currency: "USD",
    reasons: [],
  });
  assert.match(f.mark().reasons.join(" "), /matching book posting/);
  f.post({
    kind: "split",
    instrumentId: f.asset.instrumentId,
    instrumentRevision: 1,
    ratio: "2",
    evidenceRef: "split-lesson",
    occurredAt: "2026-09-03T00:00:00Z",
  });
  assert.equal(f.mark().status, "accepted");
  f.dataset.rows[0]!.timestamp = "2026-09-02T20:00:00Z";
  assert.match(f.mark().reasons.join(" "), /predates a book split/);
  f.request.overrides = [
    {
      instrumentId: f.asset.instrumentId,
      currency: "USD",
      price: "55",
      quotedAt: fixtureTime,
      sourceRef: "manual-price",
      reason: "Authored post-split quote in current book units",
    },
  ];
  const mark = f.mark();
  assert.equal(mark.status, "overridden");
  assert.equal(mark.override!.sourceRef, "manual-price");
  assert.equal(valueBook(f.book(), f.request, "USD", [mark], []).totals.nav, "10095.00");
});
