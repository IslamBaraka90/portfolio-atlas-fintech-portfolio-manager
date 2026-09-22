import type { Instrument, InstrumentCandidate } from "@portfolio-atlas/contracts";
import type { InstrumentRepository } from "@portfolio-atlas/core";
export class MemoryInstrumentRepository implements InstrumentRepository {
  private readonly candidates = new Map<string, InstrumentCandidate>();
  private readonly records = new Map<string, Instrument[]>();
  candidate(id: string) {
    return structuredClone(this.candidates.get(id));
  }
  saveCandidate(candidate: InstrumentCandidate) {
    if (this.candidates.size >= 500) this.candidates.delete(this.candidates.keys().next().value!);
    this.candidates.set(candidate.candidateId, structuredClone(candidate));
  }
  revisions(id: string) {
    return structuredClone(this.records.get(id) ?? []);
  }
  all() {
    return structuredClone([...this.records.values()].map((history) => history.at(-1)!));
  }
  get(id: string) {
    return structuredClone(this.records.get(id)?.at(-1));
  }
  save(instrument: Instrument) {
    this.records.set(instrument.instrumentId, [
      ...(this.records.get(instrument.instrumentId) ?? []),
      structuredClone(instrument),
    ]);
  }
}
