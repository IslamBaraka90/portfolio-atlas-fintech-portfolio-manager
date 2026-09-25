import assert from "node:assert/strict";
import test from "node:test";
import { parseLiveRuntime, type BarProvider, type QuoteProvider } from "@portfolio-atlas/core";
import { buildApp } from "../src/app.js";

// Saturday 26 Sep 2026: the latest completed New York session is Friday 25 Sep.
const saturday = "2026-09-26T15:00:00.000Z";

const client = (app: ReturnType<typeof buildApp>) => ({
  get: async (path: string) => (await app.inject("/api/v1" + path)).json(),
  post: (path: string, key: string) =>
    app.inject({ method: "POST", url: "/api/v1" + path, headers: { "idempotency-key": key } }),
});

test("demo mode reports its policy and records idempotent manual cycles", async (t) => {
  const app = buildApp({ clock: { now: () => saturday } });
  t.after(() => app.close());
  const api = client(app);
  const status = (await api.get("/live/status")).data;
  assert.equal(status.policy.mode, "demo");
  assert.equal(status.policy.cadence, "eod");
  assert.equal(status.scheduler, "stopped");
  assert.equal(status.session.basis, "weekend");
  assert.deepEqual(status.tasks, ["quotes", "bars"]);

  const first = await api.post("/live/cycles", "live-manual-1");
  assert.equal(first.statusCode, 201, first.body);
  const cycle = first.json().data;
  assert.equal(cycle.trigger, "manual");
  assert.equal(cycle.status, "completed");
  assert.equal(cycle.coversSession, "2026-09-25");
  assert.match(cycle.tasks[0].detail, /^4 quotes: 4 closed\.$/);
  assert.equal(first.json().metadata.mode, "synthetic");

  const replay = await api.post("/live/cycles", "live-manual-1");
  assert.equal(replay.json().data.id, cycle.id);
  assert.equal((await api.get("/live/cycles")).data.length, 1);
  assert.equal((await api.get("/live/cycles/" + cycle.id)).data.id, cycle.id);
  assert.equal((await app.inject("/api/v1/live/cycles/missing")).statusCode, 404);
});

test("live provider failures are recorded with back-off and recover", async (t) => {
  let online = false;
  const provider: QuoteProvider = {
    mode: "yahoo",
    async quotes(symbols) {
      if (!online)
        return {
          status: "unavailable",
          source: "yahoo",
          observedAt: saturday,
          cache: "none",
          failure: { code: "NETWORK", message: "offline", retryable: true },
        };
      return {
        status: "available",
        source: "yahoo",
        observedAt: saturday,
        cache: "fresh",
        data: { rows: [], missing: symbols.map((symbol) => ({ symbol, reason: "none" })), raw: [] },
      };
    },
  };
  const bars: BarProvider = {
    mode: "yahoo",
    bars: async () => ({
      status: "unavailable",
      source: "yahoo",
      observedAt: saturday,
      cache: "none",
      failure: { code: "NETWORK", message: "offline", retryable: true },
    }),
  };
  const app = buildApp({
    clock: { now: () => saturday },
    live: parseLiveRuntime({ MARKET_DATA_MODE: "live", LIVE_REFRESH: "1m" }),
    liveQuoteProvider: provider,
    liveBarProvider: bars,
  });
  t.after(() => app.close());
  const api = client(app);
  const failed = (await api.post("/live/cycles", "live-fail-1")).json();
  assert.equal(failed.metadata.mode, "yahoo");
  assert.equal(failed.data.status, "failed");
  assert.equal(failed.data.tasks[0].failure.code, "NETWORK");
  assert.equal(failed.data.health.status, "backing_off");
  assert.equal(failed.data.health.backoffMs, 60_000);
  online = true;
  const recovered = (await api.post("/live/cycles", "live-ok-1")).json().data;
  // Quotes recovered while bars stay offline: a partial cycle keeps backing off.
  assert.equal(recovered.status, "partial");
  assert.equal(recovered.health.status, "degraded");
  assert.equal(recovered.tasks[0].requested, 3);
  assert.match(recovered.tasks[0].detail, /3 unavailable/);
});

test("the event stream sends status first and then each completed cycle", async (t) => {
  const app = buildApp({ clock: { now: () => saturday } });
  t.after(() => app.close());
  await app.listen({ host: "127.0.0.1", port: 0 });
  const port = (app.server.address() as { port: number }).port;
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/live/stream`, {
    signal: controller.signal,
  });
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const until = async (pattern: RegExp) => {
    while (!pattern.test(text)) text += decoder.decode((await reader.read()).value);
  };
  await until(/event: status\n/);
  const posted = await fetch(`http://127.0.0.1:${port}/api/v1/live/cycles`, {
    method: "POST",
    headers: { "idempotency-key": "live-stream-1" },
  });
  assert.equal(posted.status, 201);
  await until(/event: cycle\ndata: .*"trigger":"manual"/);
  controller.abort();
});
