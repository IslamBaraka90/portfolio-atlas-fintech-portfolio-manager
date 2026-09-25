import assert from "node:assert/strict";
import test from "node:test";
import { barFinality, localInstant, sessionClose } from "../src/index.js";

const grace = 60_000;
const at = (
  timestamp: string,
  durationMs: number | null,
  now: string,
  timezone = "America/New_York",
) => barFinality({ timestamp, durationMs, timezone, now, graceMs: grace });

test("local session instants follow daylight saving in New York and London", () => {
  assert.equal(sessionClose("America/New_York", "2026-09-24"), "2026-09-24T20:00:00.000Z"); // EDT
  assert.equal(sessionClose("America/New_York", "2026-12-01"), "2026-12-01T21:00:00.000Z"); // EST
  assert.equal(sessionClose("Europe/London", "2026-09-24"), "2026-09-24T15:30:00.000Z"); // BST
  assert.equal(sessionClose("Europe/London", "2026-11-02"), "2026-11-02T16:30:00.000Z"); // GMT
  // The US change day itself: 09:30 on 2026-03-08 is EDT.
  assert.equal(localInstant("America/New_York", "2026-03-08", 570), "2026-03-08T13:30:00.000Z");
  assert.equal(sessionClose("Asia/Tokyo", "2026-09-24"), null);
});

test("a five-minute bar is forming until its end plus grace", () => {
  // The 14:30–14:35 New York bar (18:30Z–18:35Z).
  const forming = at("2026-09-24T18:30:00Z", 300_000, "2026-09-24T18:35:30Z");
  assert.equal(forming.finality, "incomplete");
  assert.equal(forming.end, "2026-09-24T18:35:00.000Z");
  assert.equal(forming.finalAt, "2026-09-24T18:36:00.000Z");
  assert.equal(at("2026-09-24T18:30:00Z", 300_000, "2026-09-24T18:36:00Z").finality, "final");
  assert.equal(forming.sessionDate, "2026-09-24");
});

test("the last hourly bar is cut at the close and daily bars end at the close", () => {
  const hourly = at("2026-09-24T19:30:00Z", 3_600_000, "2026-09-24T20:00:30Z");
  assert.equal(hourly.end, "2026-09-24T20:00:00.000Z");
  assert.match(hourly.evidence, /cut at the session close/);
  assert.equal(hourly.finality, "incomplete");
  const daily = barFinality({
    timestamp: "2026-09-24T13:30:00Z",
    durationMs: null,
    timezone: "America/New_York",
    now: "2026-09-24T20:14:59Z",
    graceMs: 15 * 60_000,
  });
  assert.equal(daily.finality, "incomplete");
  assert.equal(daily.finalAt, "2026-09-24T20:15:00.000Z");
  const unknown = at("2026-09-24T01:00:00Z", null, "2026-09-26T00:00:00Z", "Asia/Tokyo");
  assert.match(unknown.evidence, /Unmodeled venue/);
  assert.equal(unknown.finality, "final");
});
