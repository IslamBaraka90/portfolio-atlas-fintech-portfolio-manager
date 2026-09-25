import assert from "node:assert/strict";
import test from "node:test";
import type { QuoteObservation } from "@portfolio-atlas/contracts";
import { selectLiveMark } from "../src/index.js";

const position = { instrumentId: "DEMO-AURORA", currency: "USD" as const };
const quote = (patch: Partial<QuoteObservation>): QuoteObservation =>
  ({
    id: "q1",
    symbol: "AURA",
    providerTime: "2026-09-24T15:00:00.000Z",
    observedAt: "2026-09-24T15:00:05.000Z",
    sourceHash: "a".repeat(64),
    quoteUnit: { reported: "USD", currency: "USD", scaleToCurrency: 1, evidence: "" },
    last: 101.25,
    previousClose: 100,
    freshness: "live",
    book: { state: "normal", spread: 0.02, spreadBps: 2, midpoint: 101.24 },
    reasons: [],
    ...patch,
  }) as QuoteObservation;

test("a live last trade is the mark, recorded to eight places with its quote", () => {
  const mark = selectLiveMark(position, quote({}));
  assert.equal(mark.price, "101.25000000");
  assert.equal(mark.basis, "last");
  assert.equal(mark.status, "accepted");
  assert.equal(mark.quoteId, "q1");
  assert.equal(mark.quotedAt, "2026-09-24T15:00:00.000Z");
  assert.match(mark.reasons[0]!, /chapter-22\.live-mark\.v1/);
});

test("without a last trade the midpoint is used, but never from a crossed book", () => {
  assert.equal(selectLiveMark(position, quote({ last: null })).basis, "mid");
  assert.equal(selectLiveMark(position, quote({ last: null })).price, "101.24000000");
  const crossed = selectLiveMark(
    position,
    quote({
      last: null,
      book: { state: "crossed", spread: null, spreadBps: null, midpoint: null },
    }),
  );
  assert.equal(crossed.status, "unavailable");
  assert.equal(crossed.price, null);
});

test("closed markets use the close; stale and foreign quotes are unavailable", () => {
  const closed = selectLiveMark(position, quote({ freshness: "closed_market" }));
  assert.equal(closed.basis, "close");
  assert.equal(closed.price, "101.25000000");
  const previous = selectLiveMark(position, quote({ freshness: "closed_market", last: null }));
  assert.equal(previous.price, "100.00000000");
  const stale = selectLiveMark(position, quote({ freshness: "stale", reasons: ["too old"] }));
  assert.equal(stale.status, "unavailable");
  assert.deepEqual(stale.reasons.slice(1), ["too old"]);
  const gbp = selectLiveMark(
    position,
    quote({ quoteUnit: { reported: "GBp", currency: "GBP", scaleToCurrency: 0.01, evidence: "" } }),
  );
  assert.match(gbp.reasons[0]!, /differs from the book currency USD/);
  assert.match(selectLiveMark(position, undefined).reasons[0]!, /No live quote/);
});
