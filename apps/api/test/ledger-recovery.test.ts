import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { SqliteDatabase } from "@portfolio-atlas/adapters";
import { buildApp } from "../src/app.js";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";
test("partial journal failure rolls back and restart preserves exactly-once book evidence", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-atlas-ledger-"));
  const databasePath = join(directory, "book.sqlite");
  let app = buildApp({ databasePath, clock: { now: () => fixtureTime } });
  t.after(async () => {
    await app.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("portfolio-atlas-ledger-"));
    await rm(directory, { recursive: true, force: true });
  });
  const post = (url: string, key: string, payload: object) =>
    app.inject({
      method: "POST",
      url: "/api/v1" + url,
      headers: { "idempotency-key": key },
      payload,
    });
  const mandate = (await post("/mandates", "recovery-mandate", demoMandate)).json().data;
  const portfolio = (
    await post("/portfolios", "recovery-portfolio", {
      name: "Recovery book",
      mandateId: mandate.id,
    })
  ).json().data;
  const deposit = {
    portfolioId: portfolio.id,
    kind: "deposit",
    currency: "USD",
    amount: "10000",
    sourceRef: "deposit-one",
    occurredAt: "2026-09-01T00:00:00Z",
  };
  const db = new SqliteDatabase(databasePath);
  try {
    db.connection.exec(
      "CREATE TRIGGER fail_second_line BEFORE INSERT ON journal_lines WHEN NEW.line_number=1 BEGIN SELECT RAISE(ABORT,'injected line failure'); END;",
    );
    const failed = await post("/ledger/events", "recovery-deposit", deposit);
    assert.equal(failed.statusCode, 500);
    for (const table of ["ledger_events", "journal_entries", "journal_lines"])
      assert.equal(db.connection.prepare("SELECT count(*) AS n FROM " + table).get()!.n, 0);
    assert.equal(
      db.connection
        .prepare("SELECT count(*) AS n FROM commands WHERE command_key=?")
        .get("recovery-deposit")!.n,
      0,
    );
    db.connection.exec("DROP TRIGGER fail_second_line");
  } finally {
    db.close();
  }
  const accepted = await post("/ledger/events", "recovery-deposit", deposit);
  assert.equal(accepted.statusCode, 201, accepted.body);
  const original = accepted.json().data;
  const fee = await post("/ledger/events", "recovery-fee", {
    ...deposit,
    kind: "fee",
    amount: "5",
    sourceRef: "fee-one",
    occurredAt: "2026-09-02T00:00:00Z",
  });
  const reversal = await post("/ledger/corrections", "recovery-reversal", {
    portfolioId: portfolio.id,
    originalEventId: fee.json().data.events[1].id,
    reason: "Remove the incorrectly imported fee",
    replacement: null,
  });
  assert.equal(reversal.statusCode, 201, reversal.body);
  // Reversing the latest active earlier event must not move the append stream backwards in time.
  const reversedDeposit = await post("/ledger/corrections", "recovery-earlier-reversal", {
    portfolioId: portfolio.id,
    originalEventId: original.events[0].id,
    reason: "Remove the remaining original deposit",
    replacement: null,
  });
  assert.equal(reversedDeposit.statusCode, 201, reversedDeposit.body);
  assert.equal(reversedDeposit.json().data.book.reconciled, true);
  assert.equal(reversedDeposit.json().data.book.positions.length, 0);
  await app.close();
  app = buildApp({ databasePath, clock: { now: () => fixtureTime } });
  assert.deepEqual(
    (await post("/ledger/events", "recovery-deposit", deposit)).json().data,
    original,
  );
  const current = (await app.inject("/api/v1/portfolios/" + portfolio.id + "/book")).json().data;
  assert.equal(current.events.length, 4);
  assert.equal(current.book.reconciled, true);
  assert.ok(current.book.accounts.every((a: { balance: string }) => a.balance === "0.00"));
});
