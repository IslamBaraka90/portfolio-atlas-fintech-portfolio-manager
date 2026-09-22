import assert from "node:assert/strict";
import test from "node:test";
import { YahooChartProvider } from "../src/market-data/yahoo-finance/chart-provider.js";
import { RequestBudget } from "../src/market-data/request-budget.js";
import { MemoryRawArchive } from "../src/persistence/raw-archive.js";
import { syntheticInstruments } from "@portfolio-atlas/testing";
const request = {
  instrumentId: "demo",
  instrumentRevision: 1,
  from: "2026-09-01",
  to: "2026-09-18",
  scenario: "clean" as const,
};
const clock = { now: () => "2026-09-22T10:00:00.000Z" };
const payload = {
  meta: { symbol: "AURA.L", currency: "GBp", exchangeTimezoneName: "Europe/London" },
  quotes: [
    {
      date: new Date("2026-09-01T07:00:00Z"),
      open: 100,
      high: 102,
      low: 99,
      close: null,
      volume: 0,
      adjclose: 98,
    },
  ],
};
test("chart adapter keeps OHLC, adjclose, subunits, raw evidence and original cache time", async () => {
  let calls = 0;
  const provider = new YahooChartProvider(
    {
      chart: async () => {
        calls++;
        return payload;
      },
    },
    clock,
  );
  const first = await provider.chart(syntheticInstruments[1]!, request);
  assert.equal(first.status, "available");
  if (first.status !== "available") return;
  assert.equal(first.data.rows[0]!.close, null);
  assert.equal(first.data.rows[0]!.adjustedClose, 98);
  assert.equal(first.data.rows[0]!.volume, 0);
  assert.equal(first.data.quoteUnit.scaleToCurrency, 0.01);
  assert.equal(first.data.rows[0]!.sessionDate, "2026-09-01");
  assert.equal(first.data.rows[0]!.finality, "unknown");
  const second = await provider.chart(syntheticInstruments[1]!, request);
  assert.equal(second.cache, "hit");
  assert.equal(second.observedAt, first.observedAt);
  assert.equal(calls, 1);
  const archive = new MemoryRawArchive();
  const evidence = await archive.save(first.data.raw);
  assert.match(evidence.hash, /^[a-f0-9]{64}$/);
  assert.match(archive.entries.get(evidence.hash)!, /"close":null/);
});
test("chart failures remain unavailable and can retry, never empty synthetic success", async () => {
  let calls = 0;
  const provider = new YahooChartProvider(
    {
      chart: async () => {
        if (calls++ === 0) throw new Error("429 throttled");
        return payload;
      },
    },
    clock,
  );
  const failed = await provider.chart(syntheticInstruments[1]!, request);
  assert.equal(failed.status === "unavailable" && failed.failure.code, "THROTTLED");
  assert.equal((await provider.chart(syntheticInstruments[1]!, request)).status, "available");
  const timeout = new YahooChartProvider(
    { chart: () => new Promise(() => {}) },
    clock,
    new RequestBudget(1, 5),
  );
  const timed = await timeout.chart(syntheticInstruments[1]!, request);
  assert.equal(timed.status === "unavailable" && timed.failure.code, "TIMEOUT");
  const malformed = await new YahooChartProvider(
    { chart: async () => ({ quotes: [] }) },
    clock,
  ).chart(syntheticInstruments[1]!, request);
  assert.equal(malformed.status === "unavailable" && malformed.failure.code, "SCHEMA_MISMATCH");
});
