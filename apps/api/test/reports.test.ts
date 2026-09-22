import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
import { seedTrading } from "../../../tests/helpers/seed-trading.js";
test("reports freeze tied NAV, exceptions and exports while a superseding price revision preserves issued evidence", async (t) => {
  let now = fixtureTime;
  const app = buildApp({ clock: { now: () => now } });
  t.after(() => app.close());
  const get = async (path: string) => (await app.inject("/api/v1" + path)).json().data;
  const post = async (path: string, key: string, payload: object) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      headers: { "idempotency-key": "report-" + key },
      payload,
    });
    assert.equal(r.statusCode, 201, r.body);
    return r.json().data;
  };
  const seed = await seedTrading(get, post, "report-seed", () => now);
  const book = await post("/ledger/events", "buy", {
    portfolioId: seed.portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: seed.instruments[0]!.instrumentId,
    instrumentRevision: seed.instruments[0]!.revision,
    quantity: "10",
    unitPrice: "100",
    fee: "0",
    occurredAt: now,
    sourceRef: "report-buy",
  });
  const v = await post("/valuations", "value", {
    portfolioId: seed.portfolio.id,
    checkpoint: book.book.checkpoint,
    asOf: now,
    prices: [],
    overrides: [seed.input.newPrices[0]],
  });
  const monitor = await post("/monitors", "monitor", { valuation: { id: v.id, revision: 1 } });
  const statement = await post("/statements", "statement", {
    portfolioId: seed.portfolio.id,
    asOf: now,
    sourceRef: "report-custody",
    source: "synthetic_custodian_statement",
    trades: [],
    positions: [
      { instrumentId: seed.instruments[0]!.instrumentId, currency: "USD", settledQuantity: "9" },
    ],
    cash: [{ currency: "USD", settled: "9000.00" }],
  });
  const recon = await post("/reconciliations", "recon", {
    statement: { id: statement.id, revision: 1 },
    checkpoint: book.book.checkpoint,
    batches: [],
  });
  const request = {
    portfolioId: seed.portfolio.id,
    title: "September teaching report",
    asOf: now,
    dataCutoff: now,
    valuation: { id: v.id, revision: 1 },
    monitor: { id: monitor.id, revision: 1 },
    reconciliation: { id: recon.id, revision: 1 },
    target: { id: seed.target.id, revision: 1 },
  };
  const report = await post("/reports", "create", request);
  assert.deepEqual(report.navTie, {
    status: "reconciled",
    holdings: "1000.00",
    economicCash: "9000.00",
    nav: "10000.00",
    residual: "0.00",
  });
  assert.equal(
    report.sections.find((s: { key: string }) => s.key === "operations").status,
    "exceptions",
  );
  assert.equal(
    report.sections.find((s: { key: string }) => s.key === "performance").status,
    "missing",
  );
  assert.ok(
    report.insights.every(
      (i: { sourceRef: string; asOf: string }) => i.sourceRef && i.asOf === now,
    ),
  );
  const noAck = await app.inject({
    method: "POST",
    url: "/api/v1/reports/" + report.id + "/approval",
    headers: { "idempotency-key": "report-no-ack" },
    payload: {
      expectedRevision: 1,
      actor: "Report reviewer",
      reason: "Review selected frozen report evidence",
    },
  });
  assert.equal(noAck.statusCode, 409);
  const issued = await post("/reports/" + report.id + "/approval", "approve", {
    expectedRevision: 1,
    actor: "Report reviewer",
    reason: "Approve educational report with explicit coverage gaps",
    acknowledgeExceptions: true,
  });
  assert.equal(issued.revision, 2);
  assert.equal(issued.status, "approved");
  assert.deepEqual(issued.evidence, report.evidence);
  const json = await app.inject("/api/v1/reports/" + report.id + "/export.json?revision=2"),
    csv = await app.inject("/api/v1/reports/" + report.id + "/export.csv?revision=2");
  assert.deepEqual(json.json(), issued);
  assert.match(csv.body, /"10000.00"/);
  assert.match(csv.body, /"source_revision"/);
  now = "2026-09-22T10:01:00.000Z";
  const correction = await post("/valuations", "corrected-price", {
    portfolioId: seed.portfolio.id,
    checkpoint: book.book.checkpoint,
    asOf: now,
    prices: [],
    overrides: [
      {
        ...seed.input.newPrices[0],
        price: "110",
        quotedAt: now,
        reason: "Authored corrected quote for reporting comparison",
      },
    ],
  });
  const nextInput = {
    ...request,
    asOf: now,
    dataCutoff: now,
    valuation: { id: correction.id, revision: 1 },
    monitor: null,
    reconciliation: null,
    supersedes: { id: report.id, revision: 2 },
  };
  const next = await post("/reports", "supersede", nextInput);
  assert.equal(next.id, report.id);
  assert.equal(next.revision, 3);
  assert.equal(next.navTie.nav, "10100.00");
  assert.equal(
    (await app.inject("/api/v1/reports/" + report.id + "/export.json?revision=2")).body,
    json.body,
  );
  assert.equal(
    (await app.inject("/api/v1/reports/" + report.id + "/export.csv?revision=2")).body,
    csv.body,
  );
  const compare = await get("/reports/" + report.id + "/comparison?from=2&to=3");
  assert.equal(compare.navFrom, "10000.00");
  assert.equal(compare.navTo, "10100.00");
  assert.equal((await get("/reports/" + report.id + "/history")).length, 3);
  const mismatch = await app.inject({
    method: "POST",
    url: "/api/v1/reports",
    headers: { "idempotency-key": "report-mismatch" },
    payload: { ...nextInput, supersedes: null, monitor: { id: monitor.id, revision: 1 } },
  });
  assert.equal(mismatch.statusCode, 409);
  const empty = await post("/reports", "empty", {
    portfolioId: seed.portfolio.id,
    title: "Coverage-only report",
    asOf: now,
    dataCutoff: now,
  });
  assert.equal(empty.navTie.status, "unavailable");
  assert.equal(empty.navTie.nav, null);
  assert.ok(empty.coverage.missing > 0);
});
