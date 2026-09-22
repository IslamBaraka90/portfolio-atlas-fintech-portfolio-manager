import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMandate } from "../src/domain/evaluate-mandate.js";
import { balancedAllocation, concentratedAllocation, demoMandate } from "@portfolio-atlas/testing";

test("40% equality passes; 60% concentration breaches a 40% cap", () => {
  assert.equal(evaluateMandate(demoMandate, balancedAllocation).status, "satisfied");
  const result = evaluateMandate(demoMandate, concentratedAllocation);
  assert.equal(result.status, "breached");
  assert.equal(result.findings.find((f) => f.code === "POSITION_LIMIT")?.observed, 0.6);
});
test("cash boundaries and one basis point behave exactly", () => {
  const allocation = structuredClone(balancedAllocation);
  allocation.cashWeight = 0.05;
  allocation.positions[2]!.weight = 0.25;
  assert.equal(
    evaluateMandate(demoMandate, allocation).findings.find((f) => f.code === "CASH_MINIMUM")
      ?.status,
    "fail",
  );
  allocation.cashWeight = 0.0999;
  allocation.positions[2]!.weight = 0.2001;
  assert.equal(evaluateMandate(demoMandate, allocation).status, "breached");
  allocation.cashWeight = 0.1;
  allocation.positions[2]!.weight = 0.2;
  assert.equal(evaluateMandate(demoMandate, allocation).status, "satisfied");
});
test("110% total, duplicate IDs and contradictory policies are invalid", () => {
  assert.equal(
    evaluateMandate(demoMandate, { ...balancedAllocation, cashWeight: 0.2 }).status,
    "invalid",
  );
  const duplicate = structuredClone(balancedAllocation);
  duplicate.positions[1]!.instrumentId = duplicate.positions[0]!.instrumentId;
  assert.equal(evaluateMandate(demoMandate, duplicate).status, "invalid");
  assert.equal(
    evaluateMandate({ ...demoMandate, minCashWeight: 0.5, maxCashWeight: 0.2 }, balancedAllocation)
      .status,
    "invalid",
  );
  assert.equal(
    evaluateMandate({ ...demoMandate, allowedAssetTypes: [] }, balancedAllocation).status,
    "invalid",
  );
});
test("unknown sectors do not pass; known breaches remain visible", () => {
  const allocation = structuredClone(balancedAllocation);
  allocation.positions[0]!.sector = null;
  assert.equal(evaluateMandate(demoMandate, allocation).status, "not_evaluable");
  assert.equal(
    evaluateMandate(
      { ...demoMandate, restrictedInstrumentIds: [allocation.positions[1]!.instrumentId] },
      allocation,
    ).status,
    "breached",
  );
});
test("sector weights aggregate, asset restrictions apply and input order cannot change the verdict", () => {
  const allocation = structuredClone(balancedAllocation);
  allocation.positions[1]!.sector = allocation.positions[0]!.sector;
  const result = evaluateMandate(demoMandate, allocation);
  assert.equal(
    result.findings.find((f) => f.code === "SECTOR_LIMIT" && f.status === "fail")?.observed,
    0.7,
  );
  assert.equal(
    evaluateMandate(demoMandate, { ...allocation, positions: allocation.positions.toReversed() })
      .status,
    result.status,
  );
  assert.equal(
    evaluateMandate({ ...demoMandate, allowedAssetTypes: ["equity"] }, balancedAllocation).status,
    "breached",
  );
});
test("zero-weight rows are unheld; an all-cash mandate can allow no asset types", () => {
  assert.equal(
    evaluateMandate(
      { ...demoMandate, maxCashWeight: 1, allowedAssetTypes: [] },
      {
        ...balancedAllocation,
        cashWeight: 1,
        positions: balancedAllocation.positions.map((p) => ({ ...p, sector: null, weight: 0 })),
      },
    ).status,
    "satisfied",
  );
});
