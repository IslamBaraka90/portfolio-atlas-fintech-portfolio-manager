import assert from "node:assert/strict";
import test from "node:test";
import { candidateAllocationSchema, mandateInputSchema } from "../src/index.js";

const mandate = {
  name: "Learning portfolio",
  objective: "Keep an explicit reserve.",
  baseCurrency: "USD",
  horizonYears: 5,
  minCashWeight: 0.1,
  maxCashWeight: 0.3,
  maxPositionWeight: 0.4,
  maxSectorWeight: 0.5,
  allowedAssetTypes: ["equity", "etf"],
  restrictedInstrumentIds: [],
};

test("weights are numeric fractions on a one-basis-point grid", () => {
  assert.equal(mandateInputSchema.safeParse(mandate).success, true);
  for (const value of ["0.4", NaN, Infinity, -0.1, 40, 0.12345]) {
    assert.equal(
      mandateInputSchema.safeParse({ ...mandate, maxPositionWeight: value }).success,
      false,
    );
  }
  assert.equal(
    mandateInputSchema.safeParse({ ...mandate, maxPositionWeight: 0.1234 }).success,
    true,
  );
});
test("cross-field policy conflicts remain available for explanation by domain rules", () => {
  assert.equal(
    mandateInputSchema.safeParse({ ...mandate, minCashWeight: 0.6, maxCashWeight: 0.2 }).success,
    true,
  );
});
test("unknown sectors remain null, known labels normalize, and extra fields are rejected", () => {
  const allocation = {
    asOf: "2026-09-22T10:00:00.000Z",
    cashWeight: 0.1,
    positions: [
      {
        instrumentId: "DEMO-A",
        name: "Example holding",
        assetType: "equity",
        sector: null,
        weight: 0.9,
      },
    ],
  };
  assert.equal(candidateAllocationSchema.parse(allocation).positions[0]!.sector, null);
  assert.equal(
    candidateAllocationSchema.safeParse({ ...allocation, trusted: true }).success,
    false,
  );
  assert.equal(
    candidateAllocationSchema.safeParse({ ...allocation, asOf: "yesterday" }).success,
    false,
  );
});
test("configuration rejects duplicate asset types and unsupported currencies", () => {
  assert.equal(
    mandateInputSchema.safeParse({ ...mandate, allowedAssetTypes: ["equity", "equity"] }).success,
    false,
  );
  assert.equal(mandateInputSchema.safeParse({ ...mandate, baseCurrency: "XYZ" }).success, false);
});
