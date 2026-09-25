import assert from "node:assert/strict";
import test from "node:test";
import type { LiveEvent } from "@portfolio-atlas/contracts";
import {
  ApplicationError,
  Commands,
  LiveRefreshService,
  parseLiveRuntime,
  type RefreshTask,
  type RefreshTaskOutcome,
  type SnapshotRepository,
  type Timer,
} from "../src/index.js";

function harness(env: Record<string, string>, start: string, rows = new Map<string, unknown>()) {
  let now = start;
  const store: SnapshotRepository = {
    append: (kind, id, _revision, value) => {
      const key = kind + "/" + id;
      if (rows.has(key)) throw new Error("append-only");
      rows.set(key, structuredClone(value));
    },
    get: (kind, id) => rows.get(kind + "/" + id),
    all: (kind) => [...rows].filter(([k]) => k.startsWith(kind + "/")).map(([, v]) => v),
  };
  const saved = new Map<string, { fingerprint: string; result: unknown }>();
  const commands = new Commands({
    command: (key: string) => saved.get(key),
    saveCommand: (key: string, fingerprint: string, result: unknown) =>
      saved.set(key, { fingerprint, result }),
  } as never);
  const scheduled: { callback: () => void; ms: number }[] = [];
  const timer: Timer = {
    set: (callback, ms) => scheduled.push({ callback, ms }),
    clear: () => undefined,
  };
  let n = 0;
  const service = new LiveRefreshService(
    parseLiveRuntime(env),
    store,
    { run: (work) => work() },
    { now: () => now },
    { next: () => (env.MARKET_DATA_MODE ?? "demo") + "-cycle-" + ++n },
    commands,
    timer,
  );
  return {
    service,
    scheduled,
    set: (at: string) => (now = at),
    advance: (ms: number) => (now = new Date(Date.parse(now) + ms).toISOString()),
  };
}

const task = (outcomes: RefreshTaskOutcome[]): RefreshTask & { calls: number } => ({
  name: "probe",
  calls: 0,
  async run() {
    return outcomes[Math.min(this.calls++, outcomes.length - 1)]!;
  },
});
const ok: RefreshTaskOutcome = {
  status: "succeeded",
  requested: 1,
  succeeded: 1,
  detail: "ok",
  failure: null,
};
const down: RefreshTaskOutcome = {
  status: "failed",
  requested: 1,
  succeeded: 0,
  detail: "down",
  failure: { code: "NETWORK", message: "offline", retryable: true },
};

test("intraday cadence runs while open and records one cycle per tick", async () => {
  // Thursday 2026-09-24 11:00 EDT.
  const h = harness({ MARKET_DATA_MODE: "live", LIVE_REFRESH: "1m" }, "2026-09-24T15:00:00Z");
  h.service.register(task([ok]));
  const events: LiveEvent[] = [];
  h.service.subscribe((e) => events.push(e));
  const cycle = await h.service.tick();
  assert.equal(cycle?.status, "completed");
  assert.equal(cycle?.coversSession, null);
  assert.equal(cycle?.health.status, "healthy");
  h.advance(60_000);
  await h.service.tick();
  assert.equal(h.service.cycles().length, 2);
  assert.deepEqual(
    events.map((e) => e.type),
    ["cycle", "status", "cycle", "status"],
  );
});

test("a closed market captures the completed session exactly once", async () => {
  // Saturday: Friday 2026-09-25 is the latest completed session.
  const h = harness({ LIVE_REFRESH: "5m" }, "2026-09-26T15:00:00Z");
  h.service.register(task([ok]));
  const first = await h.service.tick();
  assert.equal(first?.coversSession, "2026-09-25");
  h.advance(300_000);
  assert.equal(await h.service.tick(), null);
  assert.match(h.service.status().decisions[0]!.reason, /already captured/);
});

test("end-of-day cadence waits through the session and runs after close plus grace", async () => {
  const h = harness({ LIVE_REFRESH: "eod" }, "2026-09-24T15:00:00Z");
  const probe = task([ok]);
  h.service.register(probe);
  // Wednesday's session is captured on the first tick; Thursday is still open.
  assert.equal((await h.service.tick())?.coversSession, "2026-09-23");
  assert.equal(await h.service.tick(), null);
  h.set("2026-09-24T20:10:00Z"); // 16:10 EDT, inside the 15-minute grace
  assert.equal(await h.service.tick(), null);
  h.set("2026-09-24T20:16:00Z");
  assert.equal((await h.service.tick())?.coversSession, "2026-09-24");
  assert.equal(probe.calls, 2);
});

test("failures back off 1x, 2x and 4x the period and one success resets health", async () => {
  const h = harness({ LIVE_REFRESH: "1m" }, "2026-09-24T15:00:00Z");
  h.service.register(task([down, down, down, ok]));
  const delays: number[] = [];
  for (let i = 0; i < 3; i++) {
    const cycle = await h.service.tick();
    assert.equal(cycle?.status, "failed");
    delays.push(cycle!.health.backoffMs);
    // A tick before the next attempt is skipped and logged.
    h.advance(cycle!.health.backoffMs - 1);
    assert.equal(await h.service.tick(), null);
    assert.match(h.service.status().decisions[0]!.reason, /Backing off/);
    h.advance(1);
  }
  assert.deepEqual(delays, [60_000, 120_000, 240_000]);
  const recovered = await h.service.tick();
  assert.equal(recovered?.health.status, "healthy");
  assert.equal(recovered?.health.consecutiveFailures, 0);
});

test("cycles never overlap and a manual refresh is idempotent", async () => {
  const h = harness({ LIVE_REFRESH: "1m" }, "2026-09-24T15:00:00Z");
  let release!: () => void;
  h.service.register({
    name: "slow",
    run: () => new Promise((resolve) => (release = () => resolve(ok))),
  });
  const running = h.service.tick();
  await new Promise((r) => setImmediate(r));
  assert.equal(await h.service.tick(), null);
  assert.match(h.service.status().decisions[0]!.reason, /never overlap/);
  await assert.rejects(
    h.service.refreshNow({ key: "manual-overlap", requestId: "r" }),
    (e) => e instanceof ApplicationError && e.code === "CYCLE_IN_PROGRESS",
  );
  release();
  await running;
  const manual = h.service.refreshNow({ key: "manual-1", requestId: "r1" });
  await new Promise((r) => setImmediate(r));
  release();
  const cycle = await manual;
  const replay = await h.service.refreshNow({ key: "manual-1", requestId: "r2" });
  assert.equal(replay.id, cycle.id);
  assert.equal(cycle.trigger, "manual");
  assert.equal(h.service.cycles().length, 2);
});

test("the scheduler starts immediately and then ticks on the period", async () => {
  const h = harness({ LIVE_REFRESH: "5m" }, "2026-09-26T15:00:00Z");
  h.service.register(task([ok]));
  h.service.start();
  assert.equal(h.scheduled[0]!.ms, 0);
  assert.equal(h.service.status().scheduler, "running");
  h.scheduled[0]!.callback();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.scheduled[1]!.ms, 300_000);
  h.service.stop();
  assert.equal(h.service.status().scheduler, "stopped");
});

test("a session captured in demo mode is captured again after switching to live", async () => {
  const rows = new Map<string, unknown>();
  const demo = harness({ LIVE_REFRESH: "eod" }, "2026-09-25T14:00:00Z", rows);
  demo.service.register(task([ok]));
  assert.equal((await demo.service.tick())?.coversSession, "2026-09-24");
  // Same storage, now live: the demo cycle does not count for the live desk.
  const live = harness(
    { MARKET_DATA_MODE: "live", LIVE_REFRESH: "eod" },
    "2026-09-25T14:05:00Z",
    rows,
  );
  live.service.register(task([ok]));
  const cycle = await live.service.tick();
  assert.equal(cycle?.mode, "live");
  assert.equal(cycle?.coversSession, "2026-09-24");
});
