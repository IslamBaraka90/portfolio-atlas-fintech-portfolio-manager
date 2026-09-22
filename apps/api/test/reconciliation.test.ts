import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";
test("immutable statement revisions, accountable resolution and reverse/repost close a cash break", async (t) => {
  const app = buildApp({ clock: { now: () => fixtureTime } });
  t.after(() => app.close());
  const get = async (path: string) => (await app.inject("/api/v1" + path)).json().data;
  const post = async (path: string, key: string, payload: object) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      headers: { "idempotency-key": key },
      payload,
    });
    assert.equal(r.statusCode, 201, r.body);
    return r.json().data;
  };
  const mandate = await post("/mandates", "recon-mandate", demoMandate);
  const portfolio = await post("/portfolios", "recon-portfolio", {
    name: "Reconciliation lesson",
    mandateId: mandate.id,
  });
  const deposit = {
    portfolioId: portfolio.id,
    kind: "deposit",
    currency: "USD",
    amount: "100",
    sourceRef: "recon-deposit",
    occurredAt: fixtureTime,
  };
  const before = await post("/ledger/events", "recon-deposit", deposit);
  const statementInput = {
    portfolioId: portfolio.id,
    asOf: fixtureTime,
    sourceRef: "independent-synthetic-custodian",
    source: "synthetic_custodian_statement",
    trades: [],
    positions: [],
    cash: [{ currency: "USD", settled: "90.00" }],
    actions: [],
  };
  const statement = await post("/statements", "recon-statement", statementInput);
  const run = await post("/reconciliations", "recon-run", {
    statement: { id: statement.id, revision: 1 },
    checkpoint: 1,
    batches: [],
  });
  assert.equal(run.status, "breaks");
  assert.equal(run.breaks[0].category, "cash");
  assert.equal(run.breaks[0].expected, "100.00");
  assert.equal(run.breaks[0].observed, "90.00");
  const resolution = await post("/resolutions", "recon-resolution", {
    runId: run.id,
    breakId: run.breaks[0].id,
    owner: "Teaching operator",
    reason: "Deposit imported with an extra ten dollars",
    evidenceRef: "custodian-line-1",
    correction: {
      portfolioId: portfolio.id,
      originalEventId: before.events[0].id,
      reason: "Correct deposit from source evidence",
      replacement: { ...deposit, amount: "90", sourceRef: "recon-replacement" },
    },
  });
  const approved = await post("/resolutions/" + resolution.id + "/approval", "recon-approval", {
    expectedRevision: 1,
  });
  assert.equal(approved.status, "corrected_requires_reconciliation");
  assert.equal(approved.journalEventIds.length, 2);
  const after = await get("/portfolios/" + portfolio.id + "/book");
  assert.equal(after.book.cash[0].settled, "90.00");
  assert.equal(after.book.reconciled, true);
  assert.deepEqual(after.journal[0], before.journal[0]);
  assert.equal((await get("/reconciliations/" + run.id)).status, "breaks");
  const fresh = await post("/reconciliations", "recon-fresh", {
    statement: { id: statement.id, revision: 1 },
    checkpoint: 3,
    batches: [],
  });
  assert.equal(fresh.status, "matched");
  const revision = await post("/statements", "recon-revision", {
    ...statementInput,
    cash: [{ currency: "USD", settled: "89.00" }],
  });
  assert.equal(revision.id, statement.id);
  assert.equal(revision.revision, 2);
  assert.equal((await get("/statements/" + statement.id + "?revision=1")).cash[0].settled, "90.00");
  const stale = await app.inject({
    method: "POST",
    url: "/api/v1/resolutions/" + resolution.id + "/approval",
    headers: { "idempotency-key": "recon-stale" },
    payload: { expectedRevision: 1 },
  });
  assert.equal(stale.statusCode, 409);
});
