import assert from "node:assert/strict";
import test from "node:test";
import { FintechMonitorAnalytics } from "../src/analytics/fintech-monitor.js";
test("independent drawdown and interpolated loss examples preserve initial wealth and signs", () => {
  const engine = new FintechMonitorAnalytics();
  const result = engine.calculate([-0.2, 0]);
  assert.ok(Math.abs(result.maximumDrawdown - 0.2) < 1e-12);
  assert.ok(Math.abs(result.valueAtRisk - 0.19) < 1e-12);
  const gains = engine.calculate([0.1, 0.2]);
  assert.ok(gains.valueAtRisk < 0);
  assert.equal(gains.maximumDrawdown, 0);
  assert.throws(() => engine.calculate([-1.1, 0]));
});
