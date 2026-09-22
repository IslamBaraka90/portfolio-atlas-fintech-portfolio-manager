import assert from "node:assert/strict";
import test from "node:test";
import { historicalFixture } from "@portfolio-atlas/testing";
import { replayFold, type FoldPlan } from "@portfolio-atlas/core";
import { FintechDrawdownEngine } from "../src/analytics/fintech-drawdown.js";
const plan: FoldPlan = {
  name: "fold-1",
  holdout: false,
  trainStart: 0,
  trainEnd: 3,
  testStart: 4,
  testEnd: 7,
  decisionAt: "2026-07-06T20:00:00Z",
  scores: [{ instrumentId: "DEMO-AURORA", score: 0.06 }],
  selectedIds: ["DEMO-AURORA"],
};
test("next-open simulation uses the existing book and exact fee/NAV arithmetic", () => {
  const fixture = historicalFixture();
  const result = replayFold(fixture, plan, "momentum", 10, new FintechDrawdownEngine());
  assert.equal(result.book.book.reconciled, true);
  assert.equal(result.book.book.positions[0]!.quantity, "74.00000000");
  assert.equal(result.fees, "7.92");
  assert.equal(result.equity.at(-1)!.nav, "10362.08");
  assert.equal(result.returnFraction, 0.036208);
  assert.equal(result.timeline.find((t) => t.kind === "fill")!.at, "2026-07-07T13:30:00Z");
  assert.ok(Math.abs(result.maximumDrawdown - (9844.08 / 10214.08 - 1)) < 1e-12);
  const free = replayFold(fixture, plan, "momentum", 0, new FintechDrawdownEngine());
  assert.equal(free.equity.at(-1)!.nav, "10370.00");
  assert.throws(
    () =>
      replayFold(
        fixture,
        { ...plan, decisionAt: "2026-07-07T20:00:00Z" },
        "momentum",
        0,
        new FintechDrawdownEngine(),
      ),
    /later open/,
  );
});
test("delisted historical member realizes its recovery through FIFO instead of disappearing", () => {
  const result = replayFold(
    historicalFixture("delisted"),
    plan,
    "momentum",
    0,
    new FintechDrawdownEngine(),
  );
  assert.equal(result.equity.at(-1)!.nav, "2452.00");
  assert.equal(result.book.book.positions.length, 0);
  assert.equal(result.timeline.filter((t) => t.kind === "forced_exit").length, 1);
  assert.equal(
    result.book.book.accounts.find((a) => a.account === "realized_pnl")!.balance,
    "7548.00",
  );
});
