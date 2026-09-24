import assert from "node:assert/strict";
import test from "node:test";
import { classifyQuote, parseLiveRuntime, type RawQuote } from "@portfolio-atlas/core";
import { FintechQuoteAnalytics } from "../src/analytics/fintech-algorithms/quote-analytics.js";
import { quoteUnit } from "../src/market-data/yahoo-finance/instrument-provider.js";

const analytics = new FintechQuoteAnalytics();
const policy = parseLiveRuntime({ LIVE_REFRESH: "5m" }); // 600 s freshness
const observedAt = "2026-09-24T15:00:00.000Z";
const minutesAgo = (m: number) => new Date(Date.parse(observedAt) - m * 60_000).toISOString();
const raw = (patch: Partial<RawQuote>): RawQuote => ({
  symbol: "SPY",
  providerTime: minutesAgo(0),
  marketState: "REGULAR",
  delaySeconds: 0,
  quoteUnit: quoteUnit("USD"),
  last: 100,
  bid: 99.99,
  ask: 100.01,
  bidSize: 100,
  askSize: 100,
  open: 99,
  high: 101,
  low: 98,
  previousClose: 98,
  volume: 1_000,
  priceHint: 2,
  ...patch,
});
const classify = (patch: Partial<RawQuote>) =>
  classifyQuote(
    raw(patch),
    {
      id: "q1",
      cycleId: "c1",
      instrumentId: null,
      source: "yahoo",
      observedAt,
      sourceHash: null,
      policy,
    },
    analytics,
  );

test("a fresh two-sided regular-hours quote is live with an evidenced spread", () => {
  const q = classify({});
  assert.equal(q.freshness, "live");
  assert.equal(q.book.state, "normal");
  assert.equal(q.book.spread, 0.02);
  assert.equal(q.book.midpoint, 100);
  assert.equal(Math.round(q.book.spreadBps! * 100) / 100, 2);
  assert.equal(q.change, 2);
  assert.equal(Math.round(q.changePercent! * 10_000) / 10_000, 2.0408);
});

test("a GBp quote of 2,510 is recorded as 25.10 GBP with scale evidence", () => {
  const q = classify({
    quoteUnit: quoteUnit("GBp"),
    last: 2510,
    bid: 2509,
    ask: 2511,
    previousClose: 2500,
  });
  assert.equal(q.reportedLast, 2510);
  assert.equal(q.last, 25.1);
  assert.equal(q.bid, 25.09);
  assert.equal(q.change, 0.1);
  assert.equal(q.quoteUnit.scaleToCurrency, 0.01);
  assert.equal(q.book.spread, 0.02);
});

test("an exchange delay extends the age budget: 20 min is delayed, 40 min is stale", () => {
  const delayed = classify({ providerTime: minutesAgo(20), delaySeconds: 900 });
  assert.equal(delayed.freshness, "delayed");
  assert.equal(delayed.ageSeconds, 1200);
  const stale = classify({ providerTime: minutesAgo(40), delaySeconds: 900 });
  assert.equal(stale.freshness, "stale");
  assert.match(stale.reasons.join(" "), /Stale-quote detector: SOURCE_EVENT_AGE/);
  // Budget boundary: 600 s + 900 s = 25 min exactly is still acceptable.
  assert.equal(classify({ providerTime: minutesAgo(25), delaySeconds: 900 }).freshness, "delayed");
});

test("a closed market state wins regardless of age", () => {
  const q = classify({ marketState: "CLOSED", providerTime: minutesAgo(2_000) });
  assert.equal(q.freshness, "closed_market");
  assert.equal(classify({ marketState: "POST" }).freshness, "closed_market");
});

test("crossed and locked books are recorded, and crossed spreads are withheld", () => {
  const crossed = classify({ bid: 101, ask: 100 });
  assert.equal(crossed.book.state, "crossed");
  assert.equal(crossed.book.spread, null);
  assert.equal(crossed.book.midpoint, null);
  const locked = classify({ bid: 100, ask: 100 });
  assert.equal(locked.book.state, "locked");
  assert.equal(locked.book.spread, 0);
});

test("missing sides, prices and times stay explicit", () => {
  const oneSided = classify({ bid: null, providerTime: minutesAgo(30) });
  assert.equal(oneSided.book.state, "one_sided");
  assert.equal(oneSided.freshness, "stale");
  assert.match(oneSided.reasons.join(" "), /Application age rule/);
  const empty = classify({ last: null, bid: null, ask: null });
  assert.equal(empty.freshness, "unavailable");
  assert.equal(empty.book.state, "absent");
  assert.equal(classify({ providerTime: null }).freshness, "unavailable");
  const skewed = classify({ providerTime: minutesAgo(-5) });
  assert.equal(skewed.freshness, "unavailable");
  assert.match(skewed.reasons.join(" "), /clock error/);
  const unknownUnit = classify({ quoteUnit: quoteUnit("JPY") });
  assert.equal(unknownUnit.last, null);
  assert.equal(unknownUnit.reportedLast, 100);
});
