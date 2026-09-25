import assert from "node:assert/strict";
import test from "node:test";
import { BookDecimal as Decimal } from "@portfolio-atlas/core";
import { demoMandate } from "@portfolio-atlas/testing";
import { buildApp } from "../src/app.js";

test("each cycle values the book from live marks and keeps one NAV point per change", async (t) => {
  let now = "2026-09-24T15:07:30.000Z"; // New York open, demo quotes live
  const app = buildApp({ clock: { now: () => now } });
  t.after(() => app.close());
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
  const mandate = await post("/mandates", "nav-mandate-key", demoMandate);
  const portfolio = await post("/portfolios", "nav-portfolio", {
    name: "Live NAV lesson",
    mandateId: mandate.id,
  });
  await post("/ledger/events", "nav-deposit", {
    portfolioId: portfolio.id,
    kind: "deposit",
    occurredAt: "2026-09-01T00:00:00Z",
    currency: "USD",
    amount: "10000",
    sourceRef: "nav-capital",
  });
  const search = await get("/instruments/search?q=AURA");
  const aura = (
    await post("/instruments/resolutions", "nav-resolve", {
      candidateId: search.candidates[0].candidateId,
    })
  ).instrument;
  await post("/ledger/events", "nav-buy-key", {
    portfolioId: portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: aura.instrumentId,
    instrumentRevision: aura.revision,
    quantity: "10",
    unitPrice: "100",
    fee: "0",
    occurredAt: now,
    sourceRef: "nav-buy-key",
  });

  const cycle = await post("/live/cycles", "nav-cycle-1");
  const task = cycle.tasks.find((x: { name: string }) => x.name === "valuation");
  assert.equal(task.detail, "1 new NAV point(s), 0 unchanged.");
  const quote = (await get("/live/quotes")).quotes.find(
    (q: { symbol: string }) => q.symbol === "AURA",
  );
  let nav = await get("/portfolios/" + portfolio.id + "/live-nav");
  assert.equal(nav.points.length, 1);
  // Independent arithmetic: 9,000 cash plus 10 shares at the observed last trade.
  const expected = new Decimal(9000).plus(new Decimal(quote.last).mul(10)).toFixed(2);
  assert.equal(nav.points[0].nav, expected);
  assert.equal(nav.points[0].status, "complete");
  const valuation = nav.latest.valuation;
  assert.equal(valuation.policyVersion, "chapter-22.live-mark.v1");
  const mark = valuation.positions[0].mark;
  assert.equal(mark.basis, "last");
  assert.equal(mark.quoteId, quote.id);
  assert.equal(mark.quotedAt, quote.providerTime);
  // The live valuation is an ordinary snapshot that earlier chapters can list.
  assert.ok(
    (await get("/valuations")).some((v: { id: string }) => v.id === valuation.id),
    "live valuations appear with Chapter 6 snapshots",
  );

  // Same inputs again: no new point, and the manual command returns the same one.
  await post("/live/cycles", "nav-cycle-2");
  assert.equal((await get("/portfolios/" + portfolio.id + "/live-nav")).points.length, 1);
  const manual = await post("/portfolios/" + portfolio.id + "/live-valuations", "nav-manual-1");
  assert.equal(manual.valuationId, valuation.id);

  // A minute later the demo price moves, so a second point is recorded.
  now = "2026-09-24T15:08:30.000Z";
  await post("/live/cycles", "nav-cycle-3");
  nav = await get("/portfolios/" + portfolio.id + "/live-nav");
  assert.equal(nav.points.length, 2);
  assert.notEqual(nav.points[1].nav, nav.points[0].nav);
});

test("a holding without a live quote leaves NAV incomplete and names the holding", async (t) => {
  const now = "2026-09-24T15:07:30.000Z";
  const app = buildApp({ clock: { now: () => now } });
  t.after(() => app.close());
  const post = async (path: string, key: string, payload: object = {}) =>
    (
      await app.inject({
        method: "POST",
        url: "/api/v1" + path,
        headers: { "idempotency-key": key },
        payload,
      })
    ).json().data;
  const mandate = await post("/mandates", "gap-mandate-key", demoMandate);
  const portfolio = await post("/portfolios", "gap-portfolio", {
    name: "Missing quote lesson",
    mandateId: mandate.id,
  });
  await post("/ledger/events", "gap-deposit", {
    portfolioId: portfolio.id,
    kind: "deposit",
    occurredAt: "2026-09-01T00:00:00Z",
    currency: "USD",
    amount: "10000",
    sourceRef: "gap-capital",
  });
  const search = (await app.inject("/api/v1/instruments/search?q=HARB")).json().data;
  const harb = (
    await post("/instruments/resolutions", "gap-resolve", {
      candidateId: search.candidates[0].candidateId,
    })
  ).instrument;
  await post("/ledger/events", "gap-buy-key", {
    portfolioId: portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: harb.instrumentId,
    instrumentRevision: harb.revision,
    quantity: "5",
    unitPrice: "100",
    fee: "0",
    occurredAt: now,
    sourceRef: "gap-buy-key",
  });
  // Remove HARB from the board: without it the saved instrument is still quoted, so
  // value before any quote cycle has run.
  const point = await post("/portfolios/" + portfolio.id + "/live-valuations", "gap-manual");
  assert.equal(point.status, "incomplete");
  assert.equal(point.nav, null);
  const nav = (await app.inject("/api/v1/portfolios/" + portfolio.id + "/live-nav")).json().data;
  const position = nav.latest.valuation.positions[0];
  assert.equal(position.mark.status, "unavailable");
  assert.match(position.reasons[0], /No live quote for this holding/);
});
