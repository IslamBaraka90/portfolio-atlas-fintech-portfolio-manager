import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";

test("each cycle derives the FX needed for quoted currencies and converts with evidence", async (t) => {
  const app = buildApp({ clock: { now: () => "2026-09-24T15:07:30.000Z" } });
  t.after(() => app.close());
  const cycle = (
    await app.inject({
      method: "POST",
      url: "/api/v1/live/cycles",
      headers: { "idempotency-key": "fx-cycle-1" },
    })
  ).json().data;
  const fxTask = cycle.tasks.find((x: { name: string }) => x.name === "fx");
  assert.equal(fxTask.status, "succeeded");
  assert.match(fxTask.detail, /^1 of 1 pairs from 1 USD legs\.$/);
  const board = (await app.inject("/api/v1/live/fx")).json().data;
  assert.equal(board.revision, 1);
  assert.equal(board.source, "synthetic");
  const gbp = board.rates[0];
  assert.equal(gbp.base + gbp.quote, "GBPUSD");
  assert.equal(gbp.derivation, "direct");
  assert.equal(gbp.quotePerBase, "1.27");
  assert.equal(gbp.legs[0].symbol, "GBPUSD=X");
  assert.match(gbp.observation.source, /chapter-21\.fx\.v1/);

  const convert = async (query: string) => app.inject("/api/v1/live/fx/convert?" + query);
  const pounds = (await convert("amount=100&from=GBP&to=USD")).json().data;
  assert.equal(pounds.converted, "127.00");
  assert.equal(pounds.boardRevision, 1);
  const back = (await convert("amount=127&from=USD&to=GBP")).json().data;
  assert.equal(back.converted, "100.00");
  assert.deepEqual(back.reasons, ["Applied the stored rate inversely."]);
  const missing = await convert("amount=1&from=EUR&to=USD");
  assert.equal(missing.statusCode, 409);
  assert.match(missing.json().error.message, /No live rate for EUR→USD/);
  assert.equal((await convert("amount=-1&from=GBP&to=USD")).statusCode, 400);

  // The FX leg is stored on the quote tape like any other observation.
  const tape = (await app.inject("/api/v1/live/quotes/GBPUSD=X")).json().data;
  assert.equal(tape.length, 1);
  assert.equal(tape[0].freshness, "live");
});
