import assert from "node:assert/strict";
import test from "node:test";
import { moneyWeighted } from "../src/domain/performance/money-weighted.js";
const start = "2025-01-01T00:00:00.000Z",
  end = "2026-01-01T00:00:00.000Z";
test("bounded IRR exposes unique, no-root and multiple-solution cash flows without arbitrary selection", () => {
  const flow = (at: string, amount: string) => ({ at, amount, sourceRef: amount });
  const one = moneyWeighted([flow(start, "-100"), flow(end, "110")], start, end);
  assert.equal(one.status, "solved");
  assert.ok(Math.abs(one.periodReturn! - 0.1) < 1e-9);
  assert.ok(Math.abs(one.annualizedReturn! - 0.1) < 1e-9);
  const middle = new Date((Date.parse(start) + Date.parse(end)) / 2).toISOString();
  const multiple = moneyWeighted(
    [flow(start, "-100"), flow(middle, "230"), flow(end, "-132")],
    start,
    end,
  );
  assert.equal(multiple.status, "ambiguous");
  assert.equal(multiple.periodReturn, null);
  assert.ok(multiple.roots.some((r) => Math.abs(r - 0.21) < 1e-7));
  assert.ok(multiple.roots.some((r) => Math.abs(r - 0.44) < 1e-7));
  assert.equal(moneyWeighted([flow(start, "100"), flow(end, "110")], start, end).status, "no_root");
  assert.equal(
    moneyWeighted([flow(start, "-100"), flow(start, "100")], start, start).status,
    "unavailable",
  );
  const shortEnd = "2025-01-02T00:00:00.000Z",
    short = moneyWeighted([flow(start, "-100"), flow(shortEnd, "110")], start, shortEnd);
  assert.ok(Math.abs(short.periodReturn! - 0.1) < 1e-9);
  assert.equal(short.annualizedReturn, null);
});
