import type { ActionReview, AdjustmentResult } from "@portfolio-atlas/contracts";
import type { ActionRepository } from "@portfolio-atlas/core";
export class MemoryActionRepository implements ActionRepository {
  private readonly reviewRecords = new Map<string, ActionReview>();
  private readonly runRecords = new Map<string, AdjustmentResult[]>();
  reviews() {
    return [...this.reviewRecords.values()].map((row) => structuredClone(row));
  }
  review(id: string) {
    const row = this.reviewRecords.get(id);
    return row ? structuredClone(row) : undefined;
  }
  saveReview(review: ActionReview) {
    if (this.reviewRecords.has(review.id)) throw new Error("Reviews are immutable.");
    this.reviewRecords.set(review.id, structuredClone(review));
  }
  runs() {
    return [...this.runRecords.values()].map((rows) => structuredClone(rows.at(-1)!));
  }
  run(id: string, revision?: number) {
    const rows = this.runRecords.get(id);
    const row =
      revision === undefined ? rows?.at(-1) : rows?.find((row) => row.revision === revision);
    return row ? structuredClone(row) : undefined;
  }
  saveRun(run: AdjustmentResult) {
    const rows = this.runRecords.get(run.id) ?? [];
    if (run.revision !== rows.length + 1) throw new Error("Runs must append revisions.");
    rows.push(structuredClone(run));
    this.runRecords.set(run.id, rows);
  }
}
