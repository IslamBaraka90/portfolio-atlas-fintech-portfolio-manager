import assert from "node:assert/strict";
import test from "node:test";
import { FintechPaperExecutionAnalytics } from "../src/analytics/fintech-paper-execution.js";
import type { PaperFill } from "@portfolio-atlas/contracts";
test("integer tick atoms and actual package residual fields reject off-grid and overfilled inputs", () => {
  const a = new FintechPaperExecutionAnalytics();
  assert.equal(a.tick("100.01", 0.01).valid, true);
  assert.equal(a.tick("100.005", 0.01).valid, false);
  const fill = (id: string, q: string, p: string): PaperFill => ({
    id,
    eventId: id,
    at: "2026-09-22T10:00:01Z",
    recordedAt: "2026-09-22T10:00:01Z",
    quantity: q,
    price: p,
    notional: "1",
    fee: "0",
    ledgerEventId: id,
    source: "authored_paper_opening_event",
    settlementPolicy: "immediate_teaching",
  });
  assert.deepEqual(a.residual("10", [fill("one", "4", "100"), fill("two", "6", "101")]), {
    filled: 10,
    remaining: 0,
    averagePrice: 100.6,
  });
  assert.throws(() => a.residual("10", [fill("one", "4", "100"), fill("two", "10", "101")]));
});
