import assert from "node:assert/strict";
import test from "node:test";
import type { LiveBar } from "@portfolio-atlas/contracts";
import { alignDailyCloses, liveRisk } from "@portfolio-atlas/core";
import { FintechLiveRiskAnalytics } from "../src/analytics/fintech-algorithms/live-risk-analytics.js";

const analytics = new FintechLiveRiskAnalytics();
const closes = [100, 101, 99.5, 102, 101.2, 103, 102.4, 104.1];
const bars = (values: number[], patch: (i: number) => Partial<LiveBar> = () => ({})): LiveBar[] =>
  values.map(
    (close, i) =>
      ({
        timestamp: `2026-09-${String(10 + i).padStart(2, "0")}T13:30:00.000Z`,
        sessionDate: `2026-09-${String(10 + i).padStart(2, "0")}`,
        close,
        finality: "final",
        accepted: true,
        ...patch(i),
      }) as LiveBar,
  );
const run = (holdingBars: LiveBar[], benchmarkBars: LiveBar[], navs: number[] = []) =>
  liveRisk({
    portfolioId: "p1",
    valuationId: "v1",
    asOf: "2026-09-24T15:00:00.000Z",
    benchmark: "ATLS",
    holdings: [{ instrumentId: "DEMO-AURORA", symbol: "AURA", weight: 1, bars: holdingBars }],
    benchmarkBars,
    navs,
    analytics,
  });

test("a holding identical to its benchmark has beta 1 and zero tracking error", () => {
  const risk = run(bars(closes), bars(closes), [10_000, 10_100, 9_595, 9_800]);
  assert.equal(risk.status, "complete");
  assert.equal(risk.window.returns, 7);
  assert.ok(Math.abs(risk.holdings[0]!.beta! - 1) < 1e-12);
  assert.ok(Math.abs(risk.portfolio.beta! - 1) < 1e-12);
  assert.ok(Math.abs(risk.portfolio.trackingError!) < 1e-12);
  assert.ok(risk.portfolio.volatility! > 0);
  assert.equal(risk.holdings[0]!.ewmaVolatility, risk.portfolio.volatility);
  // NAV 10,000 → 10,100 → 9,595: drawdown from the 10,100 peak is −5%.
  assert.ok(Math.abs(risk.portfolio.maxDrawdown! + 0.05) < 1e-12);
  assert.ok(Math.abs(risk.portfolio.currentDrawdown! - (9_800 / 10_100 - 1)) < 1e-12);
  assert.match(risk.tiers.beta!, /verified/);
});

test("a forming bar never changes the risk inputs", () => {
  const settled = run(bars(closes), bars(closes));
  const withForming = run(
    bars([...closes, 180], (i) => (i === closes.length ? { finality: "incomplete" } : {})),
    bars(closes),
  );
  assert.deepEqual(withForming.window, settled.window);
  assert.equal(withForming.holdings[0]!.ewmaVolatility, settled.holdings[0]!.ewmaVolatility);
});

test("alignment drops dates missing from any series and says how many", () => {
  const holding = bars(closes).filter((b) => b.sessionDate !== "2026-09-13");
  const aligned = alignDailyCloses([holding, bars(closes)]);
  assert.equal(aligned.droppedSessions, 1);
  assert.equal(aligned.dates.length, 7);
  const risk = run(holding, bars(closes));
  assert.match(risk.reasons.join(" "), /1 session date\(s\) dropped/);
});

test("too little history is unavailable, with every measure null", () => {
  const risk = run(bars(closes.slice(0, 3)), bars(closes.slice(0, 3)));
  assert.equal(risk.status, "unavailable");
  assert.equal(risk.portfolio.volatility, null);
  assert.equal(risk.portfolio.beta, null);
  assert.match(risk.reasons.join(" "), /At least 3 aligned final daily returns/);
  assert.match(risk.reasons.join(" "), /three valued NAV points/);
});
