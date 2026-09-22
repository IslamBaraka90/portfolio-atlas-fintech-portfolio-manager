import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  constants,
  lstatSync,
} from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { canonical, reconcileBook } from "@portfolio-atlas/core";
import { recoveryCheckpointSchema, recoveryResultSchema } from "@portfolio-atlas/contracts";
import { SqliteDatabase } from "./database.js";
import { SqliteLedgerRepository } from "./ledger-repository.js";

const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const filename = z.string().regex(/^(book\.sqlite|market-data\/[a-f0-9]{64}\.json)$/);
const manifestSchema = z.strictObject({
  id: z.string().uuid(),
  createdAt: z.iso.datetime(),
  actorId: z.string(),
  files: z.array(z.strictObject({ path: filename, hash: z.string().regex(/^[a-f0-9]{64}$/) })),
  summary: z.strictObject({
    portfolioCount: z.number().int(),
    documentCount: z.number().int(),
    booksHash: z.string(),
    documentsHash: z.string(),
  }),
});
function summary(db: SqliteDatabase, now: string) {
  const ledger = new SqliteLedgerRepository(db);
  const books = db.connection
    .prepare("SELECT id FROM portfolios ORDER BY id")
    .all()
    .map((row) => {
      const id = String(row.id),
        book = reconcileBook(id, ledger.events(id), ledger.journal(id), now);
      if (!book.reconciled) throw new Error("Ledger replay does not reconcile.");
      const { generatedAt, ...stable } = book;
      void generatedAt;
      return stable;
    });
  // Include every immutable revision, not just the currently displayed report.
  const documents = db.connection
    .prepare(
      "SELECT kind,document_id,revision,payload FROM documents ORDER BY kind,document_id,revision",
    )
    .all();
  return {
    portfolioCount: books.length,
    documentCount: documents.length,
    booksHash: sha(canonical(books)),
    documentsHash: sha(canonical(documents)),
  };
}
function archiveHashes(db: SqliteDatabase) {
  const hashes = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value && typeof value === "object")
      for (const [key, item] of Object.entries(value)) {
        if (key === "archiveRef" && typeof item === "string") {
          const match = /^sha256:([a-f0-9]{64})$/.exec(item);
          if (!match) throw new Error("Recovery requires file-backed raw evidence.");
          hashes.add(match[1]!);
        } else visit(item);
      }
  };
  for (const row of db.connection.prepare("SELECT payload FROM documents").all())
    visit(JSON.parse(String(row.payload)));
  return [...hashes].sort();
}
function regular(path: string) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("Recovery evidence must be a regular file.");
}
export class SqliteRecovery {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly directory: string,
  ) {}
  backup(now: string, actorId: string) {
    const id = randomUUID(),
      directory = join(this.directory, "backups", id);
    mkdirSync(directory, { recursive: true });
    const expected = summary(this.db, now);
    // One synchronous event-loop section: no application command can interleave.
    this.db.connection.prepare("VACUUM INTO ?").run(join(directory, "book.sqlite"));
    const files = [
      { path: "book.sqlite", hash: sha(readFileSync(join(directory, "book.sqlite"))) },
    ];
    for (const hash of archiveHashes(this.db)) {
      const source = join(this.directory, "market-data", hash + ".json");
      regular(source);
      const bytes = readFileSync(source);
      if (sha(bytes) !== hash) throw new Error("Raw archive hash mismatch.");
      mkdirSync(join(directory, "market-data"), { recursive: true });
      const path = "market-data/" + hash + ".json";
      writeFileSync(join(directory, path), bytes, { flag: "wx" });
      files.push({ path, hash });
    }
    const manifest = manifestSchema.parse({
      id,
      createdAt: now,
      actorId,
      files,
      summary: expected,
    });
    const json = JSON.stringify(manifest, null, 2) + "\n";
    writeFileSync(join(directory, "manifest.json"), json, { flag: "wx", mode: 0o600 });
    return recoveryCheckpointSchema.parse({
      id,
      createdAt: now,
      actorId,
      manifestHash: sha(json),
      portfolioCount: expected.portfolioCount,
      documentCount: expected.documentCount,
      files: files.length,
      status: "backed_up",
    });
  }
  restore(checkpoint: z.infer<typeof recoveryCheckpointSchema>, now: string, actorId: string) {
    const id = randomUUID(),
      directory = join(this.directory, "recovery", id);
    try {
      const source = join(this.directory, "backups", z.string().uuid().parse(checkpoint.id));
      const manifestPath = join(source, "manifest.json");
      regular(manifestPath);
      const bytes = readFileSync(manifestPath);
      if (sha(bytes) !== checkpoint.manifestHash) throw new Error("Manifest hash mismatch.");
      const manifest = manifestSchema.parse(JSON.parse(bytes.toString("utf8")));
      if (manifest.id !== checkpoint.id) throw new Error("Backup identity mismatch.");
      if (
        new Set(manifest.files.map((v) => v.path)).size !== manifest.files.length ||
        !manifest.files.some((v) => v.path === "book.sqlite")
      )
        throw new Error("Backup file inventory is invalid.");
      // Validate every byte before opening a database or attempting replay.
      for (const file of manifest.files) {
        const path = join(source, file.path);
        regular(path);
        if (sha(readFileSync(path)) !== file.hash) throw new Error("Backup file hash mismatch.");
      }
      mkdirSync(join(directory, "market-data"), { recursive: true });
      for (const file of manifest.files)
        copyFileSync(join(source, file.path), join(directory, file.path), constants.COPYFILE_EXCL);
      const restored = new SqliteDatabase(join(directory, "book.sqlite"));
      try {
        const integrity = restored.connection.prepare("PRAGMA integrity_check").all();
        if (
          integrity.length !== 1 ||
          Object.values(integrity[0]!)[0] !== "ok" ||
          restored.connection.prepare("PRAGMA foreign_key_check").all().length
        )
          throw new Error("SQLite integrity check failed.");
        const actual = summary(restored, now);
        if (canonical(actual) !== canonical(manifest.summary))
          throw new Error("Restored book or frozen document replay differs.");
        const required = archiveHashes(restored);
        for (const hash of required)
          if (
            !manifest.files.some(
              (f) => f.path === "market-data/" + hash + ".json" && f.hash === hash,
            )
          )
            throw new Error("Required raw evidence is missing.");
      } finally {
        restored.close();
      }
      return recoveryResultSchema.parse({
        id,
        backupId: checkpoint.id,
        at: now,
        actorId,
        status: "verified",
        reason:
          "Hashes, SQLite integrity, financial replay and every frozen document revision match.",
        restoredDirectory: directory,
        portfolioCount: manifest.summary.portfolioCount,
      });
    } catch {
      // Do not expose OS paths or driver details on failures. Preserve the attempt.
      return recoveryResultSchema.parse({
        id,
        backupId: checkpoint.id,
        at: now,
        actorId,
        status: "failed",
        reason:
          "Restore verification failed. Preserve the backup and inspect it using the recovery runbook.",
        restoredDirectory: null,
        portfolioCount: 0,
      });
    }
  }
}
