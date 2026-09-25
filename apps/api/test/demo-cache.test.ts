import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { demoMandate } from "@portfolio-atlas/testing";
import { buildApp } from "../src/app.js";

// Runs the same seeded session at the same instants and returns its NAV points.
async function session(demoCache: { mode: "record" | "replay"; path: string }) {
  let now = "2026-09-24T15:07:30.000Z";
  const app = buildApp({ clock: { now: () => now }, demoCache });
  const get = async (path: string) => (await app.inject("/api/v1" + path)).json().data;
  const post = async (path: string, key: string, payload: object = {}) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      headers: { "idempotency-key": key },
      payload,
    });
    assert.ok(r.statusCode < 300, r.body);
    return r.json().data;
  };
  const mandate = await post("/mandates", "cache-mandate-key", demoMandate);
  const portfolio = await post("/portfolios", "cache-portfolio-key", {
    name: "Demo cache lesson",
    mandateId: mandate.id,
  });
  await post("/ledger/events", "cache-deposit-key", {
    portfolioId: portfolio.id,
    kind: "deposit",
    occurredAt: "2026-09-01T00:00:00Z",
    currency: "USD",
    amount: "10000",
    sourceRef: "cache-capital",
  });
  const search = await get("/instruments/search?q=AURA");
  const aura = (
    await post("/instruments/resolutions", "cache-resolve-key", {
      candidateId: search.candidates[0].candidateId,
    })
  ).instrument;
  await post("/ledger/events", "cache-buy-key", {
    portfolioId: portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: aura.instrumentId,
    instrumentRevision: aura.revision,
    quantity: "25",
    unitPrice: "100",
    fee: "0",
    occurredAt: now,
    sourceRef: "cache-buy",
  });
  for (const [i, at] of ["2026-09-24T15:07:30.000Z", "2026-09-24T15:12:30.000Z"].entries()) {
    now = at;
    await post("/live/cycles", "cache-cycle-" + i);
  }
  const nav = await get("/portfolios/" + portfolio.id + "/live-nav");
  await app.close();
  return nav;
}

test("a recorded demo cache replays to the same NAV points and refuses a changed byte", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "atlas-cache-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "demo-cache.json");
  const recorded = await session({ mode: "record", path });
  const manifest = JSON.parse(readFileSync(path + ".manifest.json", "utf8"));
  assert.equal(manifest.version, "chapter-25.demo-cache.v1");
  assert.equal(manifest.recordedFrom, "2026-09-24T15:07:30.000Z");
  assert.ok(manifest.entries > 0);
  assert.ok(manifest.symbols.includes("AURA"));

  const replayed = await session({ mode: "replay", path });
  const view = (points: { nav: string; holdings: string; cash: string; status: string }[]) =>
    points.map((p) => [p.nav, p.holdings, p.cash, p.status]);
  assert.equal(recorded.points.length, 2);
  assert.deepEqual(view(replayed.points), view(recorded.points));
  const mark = (nav: { latest: { valuation: { positions: { mark: object }[] } } }) => {
    const { price, quotedAt, basis } = nav.latest.valuation.positions[0]!.mark as {
      price: string;
      quotedAt: string;
      basis: string;
    };
    return { price, quotedAt, basis };
  };
  assert.deepEqual(mark(replayed), mark(recorded));

  // One changed byte: the cache no longer matches its manifest and is refused.
  const text = readFileSync(path, "utf8");
  writeFileSync(path, text.replace('"AURA"', '"AURX"'));
  assert.throws(
    () => buildApp({ demoCache: { mode: "replay", path } }),
    /do not match the manifest hash/,
  );
});
