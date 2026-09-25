import assert from "node:assert/strict";
import test from "node:test";
import type { PaperOrder, QuoteObservation } from "@portfolio-atlas/contracts";
import { executionCost, quoteFill } from "../src/index.js";

const order = { side: "buy" as const, tickSize: 0.01, remainingQuantity: "10.00000000" };
const quote = (patch: Partial<QuoteObservation>): QuoteObservation =>
  ({
    id: "q-1",
    symbol: "AURA",
    providerTime: "2026-09-24T15:00:00.000Z",
    freshness: "live",
    last: 100.05,
    bid: 100.0,
    ask: 100.1,
    bidSize: 500,
    askSize: 800,
    book: { state: "normal", spread: 0.1, spreadBps: 10, midpoint: 100.05 },
    ...patch,
  }) as QuoteObservation;

test("buys fill at the ask and sells at the bid, capped by displayed size", () => {
  const buy = quoteFill(order, quote({}));
  assert.equal(buy.action, "fill");
  if (buy.action !== "fill") return;
  assert.equal(buy.price, "100.10000000");
  assert.equal(buy.live.basis, "ask");
  assert.equal(buy.capacity, 800);
  const small = quoteFill(order, quote({ askSize: 3 }));
  assert.equal(small.action === "fill" && small.capacity, 3);
  const sell = quoteFill({ ...order, side: "sell" }, quote({}));
  assert.equal(sell.action === "fill" && sell.price, "100.00000000");
});

test("a crossed or one-sided book uses a labeled half-spread model rounded against the trader", () => {
  const crossed = quote({
    book: { state: "crossed", spread: null, spreadBps: null, midpoint: null },
  });
  const buy = quoteFill(order, crossed);
  assert.equal(buy.action === "fill" && buy.live.basis, "modeled");
  // 100.05 × (1 + 5 bps) = 100.1000025 → ceil to 100.11.
  assert.equal(buy.action === "fill" && buy.price, "100.11000000");
  assert.equal(buy.action === "fill" && buy.capacity, 10, "no displayed size for a model");
  const sell = quoteFill({ ...order, side: "sell" }, quote({ bid: null }));
  // 100.05 × (1 − 5 bps) = 99.9999975 → floor to 99.99.
  assert.equal(sell.action === "fill" && sell.price, "99.99000000");
});

test("closed markets and stale quotes wait instead of filling", () => {
  const closed = quoteFill(order, quote({ freshness: "closed_market" }));
  assert.equal(closed.action, "wait");
  assert.match(closed.action === "wait" ? closed.reason : "", /next open cycle/);
  assert.equal(quoteFill(order, quote({ freshness: "stale" })).action, "wait");
  assert.equal(quoteFill(order, undefined).action, "wait");
});

test("implementation shortfall is measured against the decision price", () => {
  const filled = {
    id: "o1",
    instrumentId: "DEMO-AURORA",
    side: "buy",
    protectionPrice: "100.00000000",
    filledQuantity: "10.00000000",
    averagePrice: 100.1,
    fees: "1.00",
    fills: [
      {
        quantity: "10.00000000",
        price: "100.10000000",
        source: "live_quote_paper_fill",
        live: { midpoint: 100.05 },
      },
    ],
  } as unknown as PaperOrder;
  const cost = executionCost(filled);
  // Buy 10 at 100.10 against a 100.00 decision: shortfall 1.00, spread cost 0.50
  // against the 100.05 midpoint, fees 1.00, total 2.00 = 20 bps of 1,000.
  assert.equal(cost.shortfall, "1.00");
  assert.equal(cost.spreadCost, "0.50");
  assert.equal(cost.totalCost, "2.00");
  assert.equal(cost.totalCostBps, "20.00");
  assert.equal(cost.liveFills, 1);
  const sold = executionCost({ ...filled, side: "sell" } as PaperOrder);
  assert.equal(sold.shortfall, "-1.00", "selling above the decision price is a gain");
});
