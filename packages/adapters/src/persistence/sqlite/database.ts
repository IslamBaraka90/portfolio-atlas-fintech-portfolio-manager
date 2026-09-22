import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Transactions } from "@portfolio-atlas/core";
import { ApplicationError } from "@portfolio-atlas/core";
// SQL columns expose event relationships; JSON snapshots preserve versioned contracts.
// No financial arithmetic is delegated to SQLite REAL values.
const migration1 = `
 CREATE TABLE documents (
  kind TEXT NOT NULL, document_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>0),
  payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(kind,document_id,revision)
 ) STRICT;
 CREATE TABLE portfolios (id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload))) STRICT;
 CREATE TABLE commands (command_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result))) STRICT;
 CREATE TABLE ledger_events (
  id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL REFERENCES portfolios(id),
  sequence INTEGER NOT NULL CHECK(sequence>0), source_ref TEXT NOT NULL,
  payload TEXT NOT NULL CHECK(json_valid(payload)),
  UNIQUE(portfolio_id,sequence), UNIQUE(portfolio_id,source_ref)
 ) STRICT;
 CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY, event_id TEXT NOT NULL UNIQUE REFERENCES ledger_events(id),
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id), sequence INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('posting','memo'))
 ) STRICT;
 CREATE TABLE journal_lines (
  entry_id TEXT NOT NULL REFERENCES journal_entries(id), line_number INTEGER NOT NULL,
  account TEXT NOT NULL, currency TEXT NOT NULL, side TEXT NOT NULL CHECK(side IN ('debit','credit')),
  amount TEXT NOT NULL, PRIMARY KEY(entry_id,line_number)
 ) STRICT;
 CREATE INDEX event_portfolio_sequence ON ledger_events(portfolio_id,sequence);
`;
export class SqliteDatabase implements Transactions {
  readonly connection: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
    this.connection = new DatabaseSync(path);
    this.connection.exec(
      "PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;",
    );
    this.connection.exec(
      "CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY) STRICT;",
    );
    const row = this.connection.prepare("SELECT MAX(version) AS version FROM schema_version").get();
    const version = Number(row?.version ?? 0);
    if (version > 1) throw new Error("Database schema is newer than this application.");
    if (version === 0)
      this.run(() => {
        this.connection.exec(migration1);
        this.connection.prepare("INSERT INTO schema_version(version) VALUES(?)").run(1);
      });
  }
  run<T>(work: () => T): T {
    if (this.connection.isTransaction)
      throw new Error("Nested write transactions are not supported.");
    this.connection.exec("BEGIN IMMEDIATE");
    try {
      const value = work();
      if (value instanceof Promise)
        throw new Error("Provider I/O must complete before a write transaction.");
      this.connection.exec("COMMIT");
      return value;
    } catch (error) {
      this.connection.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.connection.close();
  }
  append(kind: string, id: string, revision: number, value: unknown) {
    const latest = this.connection
      .prepare("SELECT MAX(revision) AS revision FROM documents WHERE kind=? AND document_id=?")
      .get(kind, id);
    if (revision !== Number(latest?.revision ?? 0) + 1)
      throw new ApplicationError(
        "REVISION_CONFLICT",
        "Stored revision changed; reload before committing.",
      );
    this.connection
      .prepare("INSERT INTO documents(kind,document_id,revision,payload) VALUES(?,?,?,?)")
      .run(kind, id, revision, JSON.stringify(value));
  }
  get(kind: string, id: string, revision?: number): unknown {
    const row =
      revision === undefined
        ? this.connection
            .prepare(
              "SELECT payload FROM documents WHERE kind=? AND document_id=? ORDER BY revision DESC LIMIT 1",
            )
            .get(kind, id)
        : this.connection
            .prepare("SELECT payload FROM documents WHERE kind=? AND document_id=? AND revision=?")
            .get(kind, id, revision);
    return row ? JSON.parse(String(row.payload)) : undefined;
  }
  all(kind: string): unknown[] {
    return this.connection
      .prepare(
        "SELECT d.payload FROM documents d WHERE kind=? AND revision=(SELECT MAX(revision) FROM documents other WHERE other.kind=d.kind AND other.document_id=d.document_id) ORDER BY d.rowid",
      )
      .all(kind)
      .map((row) => JSON.parse(String(row.payload)));
  }
  revisions(kind: string, id: string): unknown[] {
    return this.connection
      .prepare("SELECT payload FROM documents WHERE kind=? AND document_id=? ORDER BY revision")
      .all(kind, id)
      .map((row) => JSON.parse(String(row.payload)));
  }
}
