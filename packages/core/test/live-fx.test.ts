import assert from "node:assert/strict";
import test from "node:test";
import type { FxBoard, QuoteObservation } from "@portfolio-atlas/contracts";
import { convertWithBoard, deriveRates, requiredLegs, requiredPairs } from "../src/index.js";

const leg = (symbol: string, last: number, providerTime: string): QuoteObservation =>
  ({
    id: "q-" + symbol,
    symbol,
    last,
    providerTime,
    freshness: "live",
  }) as QuoteObservation;
const legs = new Map([
  ["EURUSD=X", leg("EURUSD=X", 1.08, "2026-09-24T15:00:00.000Z")],
  ["GBPUSD=X", leg("GBPUSD=X", 1.27, "2026-09-24T14:59:00.000Z")],
]);
const context = { observedAt: "2026-09-24T15:00:30.000Z", maxAgeSeconds: 600, cycleId: "c1" };

test("only the needed pairs and USD legs are requested", () => {
  const { pairs, unsupported } = requiredPairs(["USD", "GBP", "EUR", "JPY", "GBP"], ["USD", "EUR"]);
  assert.deepEqual(unsupported, ["JPY"]);
  assert.deepEqual(
    pairs.map((p) => p.base + p.quote),
    ["GBPUSD", "EURUSD", "USDEUR", "GBPEUR"],
  );
  assert.deepEqual(requiredLegs(pairs), ["EURUSD=X", "GBPUSD=X"]);
});

test("direct, inverse and cross rates keep their derivation and legs", () => {
  const { rates, unavailable } = deriveRates(
    [
      { base: "EUR", quote: "USD" },
      { base: "USD", quote: "EUR" },
      { base: "GBP", quote: "EUR" },
      { base: "SAR", quote: "USD" },
    ],
    legs,
    context,
  );
  const [direct, inverse, cross] = rates;
  assert.equal(direct!.derivation, "direct");
  assert.equal(direct!.quotePerBase, "1.08");
  assert.equal(inverse!.derivation, "inverse");
  assert.equal(inverse!.quotePerBase, "0.9259259259");
  assert.equal(cross!.derivation, "cross_usd");
  // 1.27 / 1.08 = 1.17592592592…, 10 significant digits.
  assert.equal(cross!.quotePerBase, "1.175925926");
  assert.equal(cross!.providerTime, "2026-09-24T14:59:00.000Z", "timed at the older leg");
  assert.equal(cross!.legs.length, 2);
  assert.equal(cross!.observation.baseCurrency, "GBP");
  assert.equal(cross!.observation.availableAt, context.observedAt);
  assert.deepEqual(
    unavailable.map((u) => u.base + u.quote),
    ["SARUSD"],
  );
  assert.match(unavailable[0]!.reason, /never converted at 1:1/);
});

test("conversions use exact decimals and refuse missing or stale rates", () => {
  const derived = deriveRates(
    [
      { base: "EUR", quote: "USD" },
      { base: "GBP", quote: "EUR" },
    ],
    legs,
    context,
  );
  const board: FxBoard = {
    revision: 3,
    cycleId: "c1",
    updatedAt: context.observedAt,
    source: "yahoo",
    ...derived,
  };
  assert.equal(convertWithBoard("100", "EUR", "USD", board).converted, "108.00");
  assert.equal(convertWithBoard("108", "USD", "EUR", board).converted, "100.00");
  // 250 GBP × 1.175925926 = 293.98148150 → 293.98 EUR.
  assert.equal(convertWithBoard("250", "GBP", "EUR", board).converted, "293.98");
  assert.equal(convertWithBoard("10.005", "USD", "USD", board).converted, "10.00", "half-even");
  assert.equal(convertWithBoard("1", "SAR", "USD", board).converted, null);
  const stale: FxBoard = {
    ...board,
    rates: board.rates.map((r) => ({ ...r, freshness: "stale" as const })),
  };
  assert.match(convertWithBoard("1", "EUR", "USD", stale).reasons[0]!, /stale; refused/);
});
