import type { Instrument, InstrumentCandidate } from "@portfolio-atlas/contracts";
import type { InstrumentRepository } from "@portfolio-atlas/core";
export class MemoryInstrumentRepository implements InstrumentRepository {
  private readonly candidates = new Map<string, InstrumentCandidate>();
  private readonly records = new Map<string, Instrument>();
  candidate(id: string) {
    return structuredClone(this.candidates.get(id));
  }
  saveCandidate(candidate: InstrumentCandidate) {
    if (this.candidates.size >= 500) this.candidates.delete(this.candidates.keys().next().value!);
    this.candidates.set(candidate.candidateId, structuredClone(candidate));
  }
  all() {
    return structuredClone([...this.records.values()]);
  }
  get(id: string) {
    return structuredClone(this.records.get(id));
  }
  save(instrument: Instrument) {
    this.records.set(instrument.instrumentId, structuredClone(instrument));
  }
}
