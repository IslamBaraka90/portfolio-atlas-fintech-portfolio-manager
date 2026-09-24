import assert from "node:assert/strict";
import test from "node:test";
import {
  LiveConfigError,
  latestCompletedSession,
  parseLiveRuntime,
  sessionState,
} from "../src/index.js";

test("cadence sets period, cache lifetime and freshness together", () => {
  const p = parseLiveRuntime({ MARKET_DATA_MODE: "live", LIVE_REFRESH: "1m" });
  assert.equal(p.periodMs, 60_000);
  assert.ok(p.cacheTtlMs < p.periodMs, "cache must expire before the next cycle");
  assert.equal(p.freshnessSeconds, 180);
  for (const cadence of ["eod", "15m", "5m", "1m"]) {
    const q = parseLiveRuntime({ LIVE_REFRESH: cadence });
    assert.ok(q.cacheTtlMs < q.periodMs, cadence);
  }
});

test("defaults are demo mode at end of day with a unique upper-case watchlist", () => {
  const p = parseLiveRuntime({ LIVE_WATCHLIST: " spy, aapl ,msft" });
  assert.equal(p.mode, "demo");
  assert.equal(p.cadence, "eod");
  assert.deepEqual(p.watchlist, ["SPY", "AAPL", "MSFT"]);
  assert.equal(p.benchmark, "SPY");
});

test("invalid configuration stops startup and names the variable", () => {
  const fails = (env: Record<string, string>, variable: string) =>
    assert.throws(
      () => parseLiveRuntime(env),
      (e) => e instanceof LiveConfigError && e.variable === variable,
    );
  fails({ LIVE_REFRESH: "30s" }, "LIVE_REFRESH");
  fails({ MARKET_DATA_MODE: "yahoo" }, "MARKET_DATA_MODE");
  fails({ LIVE_WATCHLIST: "SPY,SPY" }, "LIVE_WATCHLIST");
  fails({ LIVE_WATCHLIST: "SP Y" }, "LIVE_WATCHLIST");
  fails({ LIVE_MAX_REQUESTS_PER_MINUTE: "0" }, "LIVE_MAX_REQUESTS_PER_MINUTE");
  fails({ LIVE_MAX_REQUESTS_PER_MINUTE: "2.5" }, "LIVE_MAX_REQUESTS_PER_MINUTE");
});

test("New York regular hours follow the US daylight-saving change", () => {
  // US DST began 2026-03-08: 14:00Z is 10:00 EDT on Monday 9 March (open),
  // but 09:00 EST on Friday 6 March (before the open).
  const monday = sessionState("America/New_York", "2026-03-09T14:00:00Z");
  assert.equal(monday.state, "open");
  assert.equal(monday.localTime, "10:00");
  const friday = sessionState("America/New_York", "2026-03-06T14:00:00Z");
  assert.equal(friday.state, "closed");
  assert.equal(friday.basis, "before_open");
  // Open boundary is inclusive, close boundary exclusive.
  assert.equal(sessionState("America/New_York", "2026-09-24T13:30:00Z").state, "open");
  assert.equal(sessionState("America/New_York", "2026-09-24T20:00:00Z").basis, "after_close");
});

test("weekends are closed, holidays are not asserted and London differs", () => {
  const saturday = sessionState("America/New_York", "2026-09-26T15:00:00Z");
  assert.equal(saturday.basis, "weekend");
  // 2026-11-26 is US Thanksgiving; holidays are explicitly unmodeled.
  const holiday = sessionState("America/New_York", "2026-11-26T15:00:00Z");
  assert.equal(holiday.state, "open");
  assert.equal(holiday.holidays, "not_modeled");
  // London is still in BST on 2026-10-20; 07:30Z is 08:30 local and open.
  assert.equal(sessionState("Europe/London", "2026-10-20T07:30:00Z").state, "open");
  assert.equal(sessionState("Asia/Tokyo", "2026-10-20T01:00:00Z").state, "unknown");
});

test("the latest completed session waits for the close plus grace", () => {
  const grace = 15 * 60_000;
  // Thursday 24 Sep 2026, 16:10 EDT: close + grace has not passed yet.
  assert.equal(
    latestCompletedSession("America/New_York", "2026-09-24T20:10:00Z", grace),
    "2026-09-23",
  );
  assert.equal(
    latestCompletedSession("America/New_York", "2026-09-24T20:16:00Z", grace),
    "2026-09-24",
  );
  // Sunday and Monday morning both point back to Friday.
  assert.equal(
    latestCompletedSession("America/New_York", "2026-09-27T15:00:00Z", grace),
    "2026-09-25",
  );
  assert.equal(
    latestCompletedSession("America/New_York", "2026-09-28T13:00:00Z", grace),
    "2026-09-25",
  );
});
