import type { MarketDataset } from "@portfolio-atlas/contracts";
import type { DatasetRepository } from "@portfolio-atlas/core";
export class MemoryDatasetRepository implements DatasetRepository {
  private readonly records = new Map<string, MarketDataset[]>();
  all() {
    return [...this.records.values()].map((rows) => structuredClone(rows.at(-1)!));
  }
  get(id: string, revision?: number) {
    const rows = this.records.get(id);
    const found =
      revision === undefined ? rows?.at(-1) : rows?.find((row) => row.revision === revision);
    return found ? structuredClone(found) : undefined;
  }
  save(dataset: MarketDataset) {
    const rows = this.records.get(dataset.id) ?? [];
    if (dataset.revision !== rows.length + 1)
      throw new Error("Dataset revisions must append without overwriting.");
    rows.push(structuredClone(dataset));
    this.records.set(dataset.id, rows);
  }
}
