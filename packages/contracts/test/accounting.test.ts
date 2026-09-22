import assert from "node:assert/strict";
import test from "node:test";
import { postingInputSchema, moneyTextSchema, quantityTextSchema } from "../src/accounting.js";
test("money crosses the API as bounded decimal strings without binary coercion", () => {
  assert.equal(moneyTextSchema.safeParse(0.1).success, false);
  assert.equal(moneyTextSchema.safeParse("0.001").success, false);
  assert.equal(moneyTextSchema.safeParse("1e3").success, false);
  assert.equal(moneyTextSchema.safeParse("0.10").success, true);
  assert.equal(quantityTextSchema.safeParse("0.00000001").success, true);
  assert.equal(quantityTextSchema.safeParse("0.000000001").success, false);
  const deposit = {
    portfolioId: "demo",
    sourceRef: "deposit-1",
    occurredAt: "2026-09-22T10:00:00Z",
    kind: "deposit",
    currency: "USD",
    amount: "10000.00",
  };
  assert.equal(postingInputSchema.parse(deposit).note, "");
  assert.equal(postingInputSchema.safeParse({ ...deposit, amount: "0.00" }).success, false);
});
