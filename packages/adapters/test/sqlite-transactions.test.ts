import assert from "node:assert/strict";
import test from "node:test";
import { SqliteDatabase } from "../src/persistence/sqlite/database.js";
import { SqlitePortfolioRepository } from "../src/persistence/sqlite/repositories.js";
import { Commands } from "@portfolio-atlas/core";
test("a command replay-record failure rolls back every state mutation", () => {
  const db = new SqliteDatabase(":memory:");
  try {
    const repo = new SqlitePortfolioRepository(db),
      commands = new Commands(repo, db);
    db.connection.exec(
      "CREATE TRIGGER reject_command BEFORE INSERT ON commands BEGIN SELECT RAISE(ABORT,'injected storage failure'); END;",
    );
    assert.throws(
      () =>
        commands.executeSync(
          "write-evidence",
          {},
          { key: "transaction-failure", requestId: "test" },
          () => {
            db.append("example", "one", 1, { value: 1 });
            return { saved: true };
          },
        ),
      /injected storage failure/,
    );
    assert.equal(db.get("example", "one"), undefined);
    assert.equal(repo.command("transaction-failure"), undefined);
    db.connection.exec("DROP TRIGGER reject_command");
    assert.deepEqual(
      commands.executeSync(
        "write-evidence",
        {},
        { key: "transaction-failure", requestId: "retry" },
        () => {
          db.append("example", "one", 1, { value: 1 });
          return { saved: true };
        },
      ),
      { saved: true },
    );
    assert.deepEqual(db.get("example", "one"), { value: 1 });
  } finally {
    db.close();
  }
});
test("async preparation holds no write transaction; replay skips repeated preparation", async () => {
  const db = new SqliteDatabase(":memory:");
  try {
    const repo = new SqlitePortfolioRepository(db),
      commands = new Commands(repo, db);
    let prepared = 0;
    const action = () =>
      commands.executePrepared(
        "provider",
        {},
        { key: "prepared-command", requestId: "test" },
        async () => {
          prepared++;
          assert.equal(db.connection.isTransaction, false);
          await Promise.resolve();
          return () => {
            assert.equal(db.connection.isTransaction, true);
            db.append("example", "prepared", 1, { value: 2 });
            return 2;
          };
        },
      );
    assert.equal(await action(), 2);
    assert.equal(await action(), 2);
    assert.equal(prepared, 1);
    assert.equal(db.connection.isTransaction, false);
  } finally {
    db.close();
  }
});
