import assert from "node:assert/strict";
import test from "node:test";
import { basisDriftLesson } from "../src/analytics/fintech-algorithms/basis-drift-lesson.js";
test("one exact split restatement passes while a hand-derived 1% residual exceeds one basis point", () => {
  const report = basisDriftLesson();
  assert.equal(report.state, "basis-drift");
  assert.equal(report.rows[0]!.state, "expected-restatement");
  assert.equal(report.rows[0]!.residualBps, 0);
  assert.equal(report.rows[1]!.state, "basis-drift");
  assert.ok(Math.abs(report.rows[1]!.residualBps - Math.log(1.01) * 10000) < 0.000001);
});
