import assert from "node:assert/strict";
import test from "node:test";
import { syntheticInstruments } from "@portfolio-atlas/testing";
import { RequestBudget } from "../src/market-data/request-budget.js";
import { SyntheticQuoteProvider } from "../src/market-data/synthetic-quote-provider.js";
import { YahooQuoteProvider } from "../src/market-data/yahoo-finance/quote-provider.js";

const clock = { now: () => "2026-09-24T15:00:00.000Z" };
// Shapes observed from Yahoo on 2026-09-24 with library result validation disabled.
const spy = {
  symbol: "SPY",
  currency: "USD",
  marketState: "REGULAR",
  exchangeDataDelayedBy: 0,
  regularMarketTime: 1_790_265_540, // epoch seconds on the raw path
  regularMarketPrice: 767.18,
  regularMarketPreviousClose: 767.81,
  bid: 767.17,
  ask: 767.19,
  bidSize: 800,
  askSize: 1_000,
};
const vod = {
  symbol: "VOD.L",
  currency: "GBp",
  marketState: "REGULAR",
  exchangeDataDelayedBy: 15,
  regularMarketTime: new Date("2026-09-24T14:40:00Z"),
  regularMarketPrice: 2510,
  bid: 0, // Yahoo's placeholder for an absent side
  ask: 2511,
};

const provider = (raw: unknown) =>
  new YahooQuoteProvider({ quotes: async () => raw }, clock, new RequestBudget(1, 1_000), 0);

test("yahoo quotes keep provider time, delay and reported units", async () => {
  const reply = await provider([spy, vod]).quotes(["SPY", "VOD.L"]);
  assert.equal(reply.status, "available");
  if (reply.status !== "available") return;
  const [a, b] = reply.data.rows;
  assert.equal(a!.providerTime, new Date(1_790_265_540_000).toISOString());
  assert.equal(a!.delaySeconds, 0);
  assert.equal(a!.quoteUnit.currency, "USD");
  assert.equal(b!.last, 2510);
  assert.equal(b!.quoteUnit.currency, "GBP");
  assert.equal(b!.quoteUnit.scaleToCurrency, 0.01);
  assert.equal(b!.delaySeconds, 900);
  assert.equal(b!.bid, null, "a zero bid is an absent side, not a price");
  assert.equal(b!.open, null, "a missing field stays null");
});

test("one drifted row or absent symbol does not discard the batch", async () => {
  const reply = await provider([spy, { symbol: "BAD", regularMarketPrice: "abc" }]).quotes([
    "SPY",
    "BAD",
    "GONE",
  ]);
  assert.equal(reply.status, "available");
  if (reply.status !== "available") return;
  assert.deepEqual(
    reply.data.rows.map((r) => r.symbol),
    ["SPY"],
  );
  assert.deepEqual(
    reply.data.missing.map((m) => m.symbol),
    ["BAD", "GONE"],
  );
  assert.match(reply.data.missing[0]!.reason, /verified contract/);
});

test("a failed batch is unavailable evidence, never synthetic data", async () => {
  const failing = new YahooQuoteProvider(
    {
      quotes: async () => {
        throw new Error("429 Too Many Requests");
      },
    },
    clock,
    new RequestBudget(1, 1_000),
    0,
  );
  const reply = await failing.quotes(["SPY"]);
  assert.equal(reply.status, "unavailable");
  if (reply.status === "unavailable") assert.equal(reply.failure.code, "THROTTLED");
});

test("demo quotes are deterministic per minute and respect pence units", async () => {
  const demo = new SyntheticQuoteProvider(syntheticInstruments, clock);
  const first = await demo.quotes(["AURA", "AURA.L", "SPY"]);
  const again = await demo.quotes(["AURA", "AURA.L", "SPY"]);
  assert.deepEqual(first, again);
  assert.equal(first.status, "available");
  if (first.status !== "available") return;
  const [usd, gbp] = first.data.rows;
  assert.equal(usd!.marketState, "REGULAR"); // 11:00 New York
  assert.ok(Math.abs(usd!.last! - 112) < 112 * 0.005);
  assert.ok(gbp!.last! > 10_000, "London listing quotes in pence");
  assert.deepEqual(first.data.missing, [
    { symbol: "SPY", reason: "Not a synthetic teaching symbol." },
  ]);
  assert.deepEqual(
    demo.defaultSymbols,
    syntheticInstruments.map((i) => i.returnedSymbol),
  );
});
