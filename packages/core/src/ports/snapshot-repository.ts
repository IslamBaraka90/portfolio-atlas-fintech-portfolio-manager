// Financial services own their schemas. Storage preserves immutable revisions.
export interface SnapshotRepository {
  append(kind: string, id: string, revision: number, value: unknown): void;
  get(kind: string, id: string, revision?: number): unknown;
  all(kind: string): unknown[];
}
