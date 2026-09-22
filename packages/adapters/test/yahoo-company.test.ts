import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeYahooCompany,
  YahooCompanyProvider,
} from "../src/market-data/yahoo-finance/company-provider.js";
import { SyntheticCompanyProvider } from "../src/market-data/synthetic-company-provider.js";
import { syntheticInstruments, fixtureTime } from "@portfolio-atlas/testing";
const request = {
  instrumentId: "AAPL",
  instrumentRevision: 1,
  from: "2023-01-01",
  to: "2026-09-22",
  frequency: "annual" as const,
  scenario: "standard" as const,
};
function payload() {
  const dates = ["2024-09-30", "2025-09-30"];
  const rows = dates.map((date) => ({
    TYPE: "FINANCIALS",
    date: new Date(date + "T00:00:00Z"),
    periodType: "12M",
    totalRevenue: 1000,
    costOfRevenue: 600,
    grossProfit: 400,
  }));
  const series = [
    ["TotalRevenue", 1000],
    ["CostOfRevenue", 600],
    ["GrossProfit", 400],
    ["NetIncome", 0],
  ] as const;
  const source = {
    timeseries: {
      result: series.map(([key, value]) => ({
        meta: { symbol: ["AAPL"], type: ["annual" + key] },
        ["annual" + key]: dates.map((asOfDate) => ({
          asOfDate,
          periodType: "12M",
          currencyCode: "USD",
          reportedValue: { raw: value },
        })),
      })),
    },
  };
  return { rows, source };
}
test("Yahoo statement adapter preserves source zero, currency, periods and current availability", () => {
  const { rows, source } = payload(),
    facts = normalizeYahooCompany("AAPL", request, rows, source, fixtureTime);
  assert.equal(facts.periods.length, 2);
  assert.equal(facts.periods[1]!.items.netIncome, 0);
  assert.equal(facts.periods[1]!.currency, "USD");
  assert.equal(facts.periods[1]!.periodType, "12M");
  assert.equal(facts.periods[1]!.availableAt, fixtureTime);
  assert.equal(facts.periods[1]!.availabilityBasis, "observed_now");
  assert.deepEqual(facts.periods[1]!.reasons, []);
});
test("missing fields, mixed currencies, wrong symbol and SDK conflicts cannot look complete", () => {
  const p = payload();
  delete (p.source.timeseries.result[3] as Record<string, unknown>).annualNetIncome;
  p.source.timeseries.result.splice(3, 1);
  assert.equal(
    normalizeYahooCompany("AAPL", request, p.rows, p.source, fixtureTime).periods[1]!.items
      .netIncome,
    null,
  );
  const mixed = payload();
  const revenue = mixed.source.timeseries.result[0]!.annualTotalRevenue as {
    currencyCode: string;
  }[];
  revenue[1]!.currencyCode = "EUR";
  const facts = normalizeYahooCompany("AAPL", request, mixed.rows, mixed.source, fixtureTime);
  assert.equal(facts.periods[1]!.currency, null);
  assert.match(facts.periods[1]!.reasons.join(" "), /currencies/);
  assert.throws(
    () => normalizeYahooCompany("MSFT", request, mixed.rows, mixed.source, fixtureTime),
    /symbol/,
  );
  mixed.rows[0]!.totalRevenue = 999;
  assert.match(
    normalizeYahooCompany(
      "AAPL",
      request,
      mixed.rows,
      mixed.source,
      fixtureTime,
    ).periods[0]!.reasons.join(" "),
    /SDK values disagree/,
  );
});
test("company provider cache preserves original known time and failures never substitute authored data", async () => {
  let now = fixtureTime,
    calls = 0;
  const transport = {
    financials: async () => {
      calls++;
      return payload();
    },
  };
  const instrument = {
    ...syntheticInstruments[0]!,
    returnedSymbol: "AAPL",
    source: "yahoo" as const,
  };
  const provider = new YahooCompanyProvider(transport, { now: () => now });
  const first = await provider.fetch(instrument, request);
  assert.equal(first.status, "available");
  now = new Date(Date.parse(now) + 1000).toISOString();
  const again = await provider.fetch(instrument, request);
  assert.equal(again.cache, "hit");
  assert.equal(again.observedAt, first.observedAt);
  assert.equal(calls, 1);
  const failed = await new YahooCompanyProvider(
    {
      financials: async () => {
        throw new Error("429");
      },
    },
    { now: () => now },
  ).fetch(instrument, request);
  assert.equal(failed.status, "unavailable");
  if (failed.status === "unavailable") assert.equal(failed.failure.code, "THROTTLED");
});
test("authored revisions keep both release times instead of rewriting an earlier period", async () => {
  const result = await new SyntheticCompanyProvider({ now: () => fixtureTime }).fetch(
    syntheticInstruments[0]!,
    { ...request, scenario: "late-revision" },
  );
  assert.equal(result.status, "available");
  if (result.status === "available") {
    assert.equal(result.data.periods.length, 3);
    assert.equal(result.data.periods[1]!.items.netIncome, 180);
    assert.equal(result.data.periods[2]!.items.netIncome, 150);
    assert.ok(result.data.periods[2]!.availableAt > result.data.periods[1]!.availableAt);
  }
});
