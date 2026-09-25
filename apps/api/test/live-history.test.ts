import assert from "node:assert/strict";
import test from "node:test";
import { parseLiveRuntime } from "@portfolio-atlas/core";
import { buildApp } from "../src/app.js";

test("live bars refresh incrementally: append, finalize and never rewrite", async (t) => {
  let now = "2026-09-24T15:07:30.000Z"; // 11:07:30 New York
  const app = buildApp({
    clock: { now: () => now },
    live: parseLiveRuntime({ LIVE_REFRESH: "5m" }),
  });
  t.after(() => app.close());
  const cycle = async (key: string) =>
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/live/cycles",
        headers: { "idempotency-key": key },
      })
    ).json().data;
  const bars = async (symbol: string, interval: string) =>
    (await app.inject(`/api/v1/live/series/${symbol}/${interval}/bars`)).json().data;

  const first = await cycle("history-1");
  const task = first.tasks.find((x: { name: string }) => x.name === "bars");
  assert.equal(task.status, "succeeded");
  assert.match(task.detail, /^8 of 8 series/);
  const series = (await app.inject("/api/v1/live/series")).json().data;
  assert.deepEqual(
    series.map((s: { id: string }) => s.id).filter((id: string) => id.startsWith("AURA|")),
    ["AURA|1d", "AURA|5m"],
  );
  let aura = await bars("AURA", "5m");
  assert.equal(aura.series.policy, "chapter-20.live-bars.v1");
  const forming = aura.bars.at(-1);
  assert.equal(forming.timestamp, "2026-09-24T15:05:00.000Z");
  assert.equal(forming.finality, "incomplete");
  assert.ok(forming.findings.some((f: { code: string }) => f.code === "FORMING"));
  assert.equal(aura.bars.at(-2).finality, "final");
  const finalBefore = aura.bars.at(-2);

  // Same instant again: nothing new, so nothing is written.
  await cycle("history-2");
  assert.equal((await bars("AURA", "5m")).series.revision, aura.series.revision);

  // Six minutes later the 11:05 bar is final and 11:10 is forming.
  now = "2026-09-24T15:13:30.000Z";
  await cycle("history-3");
  aura = await bars("AURA", "5m");
  const finalized = aura.bars.find((b: { timestamp: string }) => b.timestamp === forming.timestamp);
  assert.equal(finalized.finality, "final");
  assert.equal(finalized.revision, 2);
  assert.equal(finalized.firstObservedAt, "2026-09-24T15:07:30.000Z");
  assert.equal(aura.series.lastRefresh.appended, 1);
  assert.equal(aura.series.lastRefresh.finalized, 1);
  const unchanged = aura.bars.find(
    (b: { timestamp: string }) => b.timestamp === finalBefore.timestamp,
  );
  assert.equal(unchanged.revision, 1, "a final bar never gets a new revision");

  const daily = await bars("AURA", "1d");
  assert.equal(daily.bars.at(-1).sessionDate, "2026-09-24");
  assert.equal(daily.bars.at(-1).finality, "incomplete");
  assert.equal(daily.bars.at(-2).finality, "final");
  const london = await bars("AURA.L", "5m");
  assert.equal(london.series.quoteUnit.scaleToCurrency, 0.01);
  assert.ok(london.bars.at(-1).close < 1_000, "pence scaled into pounds");
});

test("an unknown symbol is reported without failing the whole task", async (t) => {
  const app = buildApp({ clock: { now: () => "2026-09-24T15:07:30.000Z" } });
  t.after(() => app.close());
  await app.inject({
    method: "POST",
    url: "/api/v1/live/watchlist",
    headers: { "idempotency-key": "history-watch" },
    payload: { expectedRevision: 1, action: "add", symbol: "ZZZ" },
  });
  const cycle = (
    await app.inject({
      method: "POST",
      url: "/api/v1/live/cycles",
      headers: { "idempotency-key": "history-unknown" },
    })
  ).json().data;
  const task = cycle.tasks.find((x: { name: string }) => x.name === "bars");
  assert.equal(task.status, "succeeded");
  assert.match(task.detail, /unavailable: ZZZ \(NOT_FOUND\)/);
  assert.equal(cycle.status, "completed");
});
