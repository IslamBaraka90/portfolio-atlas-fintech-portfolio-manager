import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";

// Thursday 24 Sep 2026, 11:00 New York: the demo venue is open.
const open = "2026-09-24T15:00:00.000Z";

test("each cycle records a quote tape and a revisioned board for the watchlist", async (t) => {
  let now = open;
  const app = buildApp({ clock: { now: () => now } });
  t.after(() => app.close());
  const get = async (path: string) => (await app.inject("/api/v1" + path)).json().data;
  const post = (path: string, key: string, payload?: object) =>
    app.inject({
      method: "POST",
      url: "/api/v1" + path,
      headers: { "idempotency-key": key },
      ...(payload ? { payload } : {}),
    });

  assert.deepEqual((await get("/live/quotes")).quotes, []);
  const watchlist = await get("/live/watchlist");
  assert.deepEqual([...watchlist.symbols].sort(), ["ATLS", "AURA", "AURA.L", "HARB"]);
  assert.equal(watchlist.revision, 1);

  const cycle = (await post("/live/cycles", "quotes-cycle-1")).json().data;
  assert.match(cycle.tasks[0].detail, /4 quotes: .*live/);
  const board = await get("/live/quotes");
  assert.equal(board.revision, 1);
  assert.equal(board.cycleId, cycle.id);
  const aura = board.quotes.find((q: { symbol: string }) => q.symbol === "AURA");
  assert.equal(aura.freshness, "live");
  assert.equal(aura.book.state, "normal");
  assert.equal(aura.quoteUnit.currency, "USD");
  assert.match(aura.sourceHash, /^[0-9a-f]{64}$/);
  const london = board.quotes.find((q: { symbol: string }) => q.symbol === "AURA.L");
  assert.equal(london.quoteUnit.scaleToCurrency, 0.01);
  assert.ok(Math.abs(london.last - london.reportedLast / 100) < 1e-9);

  // Adding an unknown symbol records an explicit unavailable observation.
  const added = await post("/live/watchlist", "watch-add-1", {
    expectedRevision: 1,
    action: "add",
    symbol: "zzz",
  });
  assert.equal(added.statusCode, 201, added.body);
  assert.deepEqual(added.json().data.symbols.at(-1), "ZZZ");
  const stale = await post("/live/watchlist", "watch-add-2", {
    expectedRevision: 1,
    action: "add",
    symbol: "QQQ",
  });
  assert.equal(stale.statusCode, 409);

  now = "2026-09-24T15:05:00.000Z";
  await post("/live/cycles", "quotes-cycle-2");
  const next = await get("/live/quotes");
  assert.equal(next.revision, 2);
  const zzz = next.quotes.find((q: { symbol: string }) => q.symbol === "ZZZ");
  assert.equal(zzz.freshness, "unavailable");
  assert.equal(zzz.last, null);
  assert.deepEqual(zzz.reasons, ["Not a synthetic teaching symbol."]);

  const tape = await get("/live/quotes/AURA");
  assert.equal(tape.length, 2);
  assert.ok(tape[0].observedAt > tape[1].observedAt, "newest first");

  const removed = await post("/live/watchlist", "watch-remove-1", {
    expectedRevision: 2,
    action: "remove",
    symbol: "ZZZ",
  });
  assert.equal(removed.json().data.revision, 3);
  assert.equal(
    (
      await post("/live/watchlist", "watch-remove-2", {
        expectedRevision: 3,
        action: "remove",
        symbol: "ZZZ",
      })
    ).statusCode,
    404,
  );
});

test("saved instruments are quoted and linked to their permanent identity", async (t) => {
  const app = buildApp({ clock: { now: () => open } });
  t.after(() => app.close());
  const search = (await app.inject("/api/v1/instruments/search?q=Aurora&mode=synthetic")).json()
    .data;
  const candidate = search.candidates.find(
    (c: { providerSymbol: string }) => c.providerSymbol === "AURA",
  );
  const resolved = await app.inject({
    method: "POST",
    url: "/api/v1/instruments/resolutions",
    headers: { "idempotency-key": "resolve-aura-quotes" },
    payload: { candidateId: candidate.candidateId },
  });
  assert.equal(resolved.statusCode, 201, resolved.body);
  await app.inject({
    method: "POST",
    url: "/api/v1/live/cycles",
    headers: { "idempotency-key": "quotes-linked-1" },
  });
  const board = (await app.inject("/api/v1/live/quotes")).json().data;
  const aura = board.quotes.find((q: { symbol: string }) => q.symbol === "AURA");
  assert.equal(aura.instrumentId, resolved.json().data.instrument.instrumentId);
});
