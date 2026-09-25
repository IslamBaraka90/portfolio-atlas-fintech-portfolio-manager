import assert from "node:assert/strict";
import test from "node:test";
import { syntheticInstruments } from "@portfolio-atlas/testing";
import { IntervalLimitError, checkIntervalWindow, intervalForCadence } from "@portfolio-atlas/core";
import { RequestBudget } from "../src/market-data/request-budget.js";
import { SyntheticBarProvider } from "../src/market-data/synthetic-bar-provider.js";
import { SyntheticQuoteProvider } from "../src/market-data/synthetic-quote-provider.js";
import { YahooBarProvider } from "../src/market-data/yahoo-finance/bar-provider.js";

const now = "2026-09-24T15:07:30.000Z"; // 11:07:30 New York, market open

test("provider interval limits refuse impossible requests before any network call", () => {
  const ago = (days: number) => new Date(Date.parse(now) - days * 86_400_000).toISOString();
  assert.throws(
    () => checkIntervalWindow("1m", ago(40), ago(39), now),
    (e) => e instanceof IntervalLimitError && /last 30 days/.test(e.message),
  );
  assert.throws(
    () => checkIntervalWindow("1m", ago(10), now, now),
    (e) => e instanceof IntervalLimitError && /at most 7 days/.test(e.message),
  );
  assert.doesNotThrow(() => checkIntervalWindow("1m", ago(6), now, now));
  assert.doesNotThrow(() => checkIntervalWindow("1d", ago(3_000), now, now));
  assert.throws(() => checkIntervalWindow("5m", now, now, now), IntervalLimitError);
  assert.equal(intervalForCadence("eod"), "1d");
  assert.equal(intervalForCadence("5m"), "5m");
});

test("yahoo chart rows map to provider-neutral bars with exchange timezone and units", async () => {
  const provider = new YahooBarProvider(
    {
      bars: async () => ({
        meta: {
          symbol: "VOD.L",
          currency: "GBp",
          exchangeTimezoneName: "Europe/London",
          priceHint: 2,
        },
        quotes: [
          {
            date: new Date("2026-09-24T08:00:00Z"),
            open: 2500,
            high: 2512,
            low: 2498,
            close: 2510,
            volume: 1_200,
          },
          {
            date: new Date("2026-09-24T08:05:00Z"),
            open: null,
            high: null,
            low: null,
            close: null,
          },
        ],
      }),
    },
    { now: () => now },
    new RequestBudget(1, 1_000),
    0,
  );
  const reply = await provider.bars("VOD.L", "5m", { from: "2026-09-24T08:00:00Z", to: now });
  assert.equal(reply.status, "available");
  if (reply.status !== "available") return;
  assert.equal(reply.data.timezone, "Europe/London");
  assert.equal(reply.data.quoteUnit.scaleToCurrency, 0.01);
  assert.equal(reply.data.rows[0]!.close, 2510);
  assert.equal(reply.data.rows[1]!.close, null, "a missing close stays null, never zero");
  assert.equal(reply.data.rows[1]!.volume, null);
});

test("demo bars cover regular hours only, stop at the clock and agree with demo quotes", async () => {
  const clock = { now: () => now };
  const bars = new SyntheticBarProvider(syntheticInstruments, clock);
  const reply = await bars.bars("AURA", "5m", { from: "2026-09-24T13:00:00Z", to: now });
  assert.equal(reply.status, "available");
  if (reply.status !== "available") return;
  // 09:30 to 11:07:30 New York: 19 full five-minute bars plus the forming 11:05 bar.
  assert.equal(reply.data.rows.length, 20);
  assert.equal(reply.data.rows[0]!.timestamp, "2026-09-24T13:30:00.000Z");
  assert.equal(reply.data.rows.at(-1)!.timestamp, "2026-09-24T15:05:00.000Z");
  const quotes = await new SyntheticQuoteProvider(syntheticInstruments, clock).quotes(["AURA"]);
  if (quotes.status !== "available") return assert.fail();
  // The quote at 11:07 equals the forming bar's close built through 11:07.
  assert.equal(reply.data.rows.at(-1)!.close, quotes.data.rows[0]!.last);
  const daily = await bars.bars("AURA", "1d", { from: "2026-09-21T00:00:00Z", to: now });
  if (daily.status !== "available") return assert.fail();
  assert.deepEqual(
    daily.data.rows.map((r) => r.timestamp),
    [
      "2026-09-21T13:30:00.000Z",
      "2026-09-22T13:30:00.000Z",
      "2026-09-23T13:30:00.000Z",
      "2026-09-24T13:30:00.000Z",
    ],
  );
  const unknown = await bars.bars("SPY", "5m", { from: "2026-09-24T13:00:00Z", to: now });
  assert.equal(unknown.status, "unavailable");
});
