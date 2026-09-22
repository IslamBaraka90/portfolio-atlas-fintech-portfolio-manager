import assert from "node:assert/strict";
import test from "node:test";
import { FintechLotScoringEngine } from "../src/analytics/fintech-lot-scoring.js";
test("D14 fixed-sale comparison keeps illustrative loss scores out of book cash", () => {
  const lots = [
    {
      lotId: "old",
      acquisitionEventId: "old",
      instrumentId: "a",
      currency: "USD" as const,
      acquiredAt: "2025-01-01T00:00:00Z",
      quantityRemaining: "10",
      costRemaining: "500",
      unitCost: "50",
    },
    {
      lotId: "new",
      acquisitionEventId: "new",
      instrumentId: "a",
      currency: "USD" as const,
      acquiredAt: "2025-02-01T00:00:00Z",
      quantityRemaining: "10",
      costRemaining: "1200",
      unitCost: "120",
    },
  ];
  const result = new FintechLotScoringEngine().compare(
    "a",
    "100",
    "10",
    lots,
    "2026-09-22T00:00:00Z",
    0.2,
  );
  assert.equal(result.status, "available", result.reason);
  assert.deepEqual(result.oldestFirst!.fillSequence, ["old"]);
  assert.deepEqual(result.lowestScore!.fillSequence, ["new"]);
  assert.ok(Math.abs(Number(result.lowestScore!.totalScore) + 40) < 1e-10);
  assert.equal(result.lowestScore!.settlementCash, 0);
  assert.equal(result.affectsCash, false);
  assert.equal(result.changesBookLots, false);
  assert.ok((result.lowestScore!.policy as { missing: string[] }).missing.includes("jurisdiction"));
  assert.equal(
    new FintechLotScoringEngine().compare("a", "100", "30", lots, "2026-09-22T00:00:00Z", 0.2)
      .status,
    "unavailable",
  );
});
