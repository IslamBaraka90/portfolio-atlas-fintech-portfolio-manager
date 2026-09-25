import assert from "node:assert/strict";
import test from "node:test";
import type { RawBar } from "@portfolio-atlas/core";
import { FintechLiveBarQuality } from "../src/analytics/fintech-algorithms/live-bar-quality.js";

const quality = new FintechLiveBarQuality();
const observedAt = "2026-09-24T16:00:00.000Z";
const bar = (i: number, close: number, patch: Partial<RawBar> = {}): RawBar => ({
  timestamp: new Date(Date.parse("2026-09-24T13:30:00Z") + i * 300_000).toISOString(),
  open: close,
  high: close + 0.05,
  low: close - 0.05,
  close,
  volume: 1_000,
  ...patch,
});
const run = (rows: RawBar[], instrumentId: string | null = "DEMO-AURORA") =>
  quality.validate({ symbol: "AURA", instrumentId, rows, priceHint: 2, scale: 1, observedAt });

test("valid live bars are accepted with the inferred tick labeled", () => {
  const result = run([bar(0, 100), bar(1, 100.1)]);
  assert.deepEqual(
    result.map((r) => r.accepted),
    [true, true],
  );
  assert.ok(
    result[0]!.findings.some((f) => f.code === "INFERRED_TICK" && f.severity === "warning"),
  );
  assert.equal(quality.policy, "chapter-20.live-bars.v1");
});

test("broken rows are quarantined with reasons and never filled", () => {
  const result = run([
    bar(0, 100),
    bar(1, 100, { high: 99 }), // high below close
    bar(2, 100, { close: null }),
    bar(1, 100), // duplicate start and out of order
    bar(40, 100), // after the observation
  ]);
  assert.deepEqual(
    result.map((r) => r.accepted),
    [true, false, false, false, false],
  );
  const codes = (i: number) => result[i]!.findings.map((f) => f.code);
  assert.ok(codes(2).includes("INVALID_PRICE_CLOSE"));
  assert.ok(codes(3).includes("DUPLICATE_TIMESTAMP"));
  assert.ok(codes(3).includes("OUT_OF_ORDER"));
  assert.ok(codes(4).includes("FUTURE_EVENT"));
});

test("a causal Hampel outlier is flagged as a warning and the bar is kept", () => {
  const rows = Array.from({ length: 20 }, (_, i) => bar(i, 100 + (i % 2) * 0.02));
  rows.push(bar(20, 112));
  const result = run(rows, null);
  const spike = result.at(-1)!;
  assert.equal(spike.accepted, true, "an outlier is kept for review, not deleted");
  assert.ok(spike.findings.some((f) => f.code === "HAMPEL_OUTLIER"));
  assert.ok(result[0]!.findings.some((f) => f.code === "WATCHLIST_ONLY_IDENTITY"));
  assert.ok(!result[5]!.findings.some((f) => f.code === "HAMPEL_OUTLIER"));
});
