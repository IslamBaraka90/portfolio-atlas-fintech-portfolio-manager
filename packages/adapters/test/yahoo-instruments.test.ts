import assert from "node:assert/strict";
import test from "node:test";
import {
  quoteUnit,
  YahooInstrumentProvider,
  type YahooTransport,
} from "../src/market-data/yahoo-finance/instrument-provider.js";
import { ProviderError, RequestBudget } from "../src/market-data/request-budget.js";
const clock = { now: () => "2026-09-22T10:00:00.000Z" };
const transport: YahooTransport = {
  search: async () => ({
    quotes: [
      {
        isYahooFinance: true,
        symbol: "TEST.L",
        shortname: "Teaching Co",
        exchange: "LSE",
        quoteType: "EQUITY",
      },
      { isYahooFinance: false },
    ],
  }),
  quote: async (symbol) => ({
    symbol,
    longName: "Teaching Co",
    currency: "GBp",
    quoteType: "EQUITY",
    priceHint: 2,
    exchange: "LSE",
    exchangeTimezoneName: "Europe/London",
  }),
};
test("Yahoo mapping keeps subunits, observed venue and missing legal tick evidence", async () => {
  const provider = new YahooInstrumentProvider(transport, clock);
  const search = await provider.search("Teaching");
  assert.equal(search.status, "available");
  if (search.status !== "available") return;
  assert.equal(search.data.length, 1);
  assert.equal(search.data[0]?.quoteUnit.currency, null);
  const result = await provider.observe("TEST.L");
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.data.quoteUnit.scaleToCurrency, 0.01);
  assert.equal(result.data.tickSize, null);
  assert.equal(result.data.venueMic, null);
  assert.equal(125 * result.data.quoteUnit.scaleToCurrency!, 1.25);
  assert.equal(quoteUnit("GBP").scaleToCurrency, 1);
  assert.equal(quoteUnit("mystery").currency, null);
});
test("cached observations retain their evidence time; malformed and failed calls are explicit", async () => {
  let calls = 0;
  const provider = new YahooInstrumentProvider(
    {
      ...transport,
      quote: async (...args) => {
        calls++;
        return transport.quote(...args);
      },
    },
    clock,
  );
  const first = await provider.observe("TEST.L");
  const second = await provider.observe("TEST.L");
  assert.equal(second.cache, "hit");
  assert.equal(second.observedAt, first.observedAt);
  assert.equal(calls, 1);
  const malformed = await new YahooInstrumentProvider(
    { ...transport, quote: async () => ({ symbol: 123 }) },
    clock,
  ).observe("TEST");
  assert.equal(malformed.status === "unavailable" && malformed.failure.code, "SCHEMA_MISMATCH");
  const failed = await new YahooInstrumentProvider(
    {
      ...transport,
      search: async () => {
        throw new Error("429 rate limit");
      },
    },
    clock,
  ).search("TEST");
  assert.equal(failed.status === "unavailable" && failed.failure.code, "THROTTLED");
});
test("timeout cannot release a still-running concurrency slot", async () => {
  const budget = new RequestBudget(1, 15);
  let settle!: () => void;
  let cancelled = false;
  await assert.rejects(
    budget.run(
      (signal) =>
        new Promise<void>((resolve) => {
          settle = resolve;
          signal.addEventListener("abort", () => {
            cancelled = true;
          });
        }),
    ),
    (error: unknown) => error instanceof ProviderError && error.failure.code === "TIMEOUT",
  );
  assert.equal(cancelled, true);
  await assert.rejects(
    budget.run(async () => 1),
    (error: unknown) => error instanceof ProviderError && error.failure.code === "BUDGET_EXCEEDED",
  );
  settle();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await budget.run(async () => 2), 2);
});
