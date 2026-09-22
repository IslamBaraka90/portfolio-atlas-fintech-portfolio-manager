import type { SnapshotRepository } from "@portfolio-atlas/core";
import type { SqliteDatabase } from "./database.js";
export class SqliteSnapshotRepository implements SnapshotRepository {
  constructor(private readonly db: SqliteDatabase) {}
  append(kind: string, id: string, revision: number, value: unknown) {
    if (!this.db.connection.isTransaction)
      throw new Error("Snapshot writes require an enclosing command transaction.");
    this.db.append(kind, id, revision, value);
  }
  get(kind: string, id: string, revision?: number) {
    return this.db.get(kind, id, revision);
  }
  all(kind: string) {
    return this.db.all(kind);
  }
}
