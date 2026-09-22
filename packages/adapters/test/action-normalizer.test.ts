import assert from "node:assert/strict";
import test from "node:test";
import { ProviderActionNormalizer } from "../src/market-data/action-normalizer.js";
import { actionLessonTimeline, fixtureTime, syntheticInstruments } from "@portfolio-atlas/testing";
import type { MarketDataset } from "@portfolio-atlas/contracts";
test("Yahoo events retain ratios and unknown currency without becoming confirmed postings", () => {
  const dataset = {
    source: "yahoo",
    instrument: syntheticInstruments[0]!,
    observedAt: fixtureTime,
    timezone: "America/New_York",
    sourceHash: "a".repeat(64),
  } as MarketDataset;
  const result = new ProviderActionNormalizer().normalize(dataset, {
    events: {
      splits: [{ date: "2026-09-03T13:30:00.000Z", numerator: 2, denominator: 1 }],
      dividends: [
        { date: "2026-09-08T13:30:00.000Z", amount: 2 },
        { date: "invalid", amount: null },
      ],
    },
  });
  assert.equal(result.actions.length, 3);
  assert.equal(result.actions[0]!.ratio, 2);
  assert.equal(result.actions[0]!.status, "candidate");
  assert.equal(result.actions[1]!.currency, null);
  assert.equal(result.actions[1]!.availableAt, fixtureTime);
  assert.equal(result.actions[2]!.effectiveDate, null);
});
test("authored action revisions retain correction and cancellation evidence", () => {
  const actions = actionLessonTimeline("DEMO", "USD", fixtureTime);
  assert.deepEqual(
    actions
      .filter((row) => row.kind === "cash_dividend")
      .map((row) => [row.revision, row.amount, row.status]),
    [
      [1, 2, "confirmed"],
      [2, 2.5, "confirmed"],
      [3, 2.5, "cancelled"],
    ],
  );
});
