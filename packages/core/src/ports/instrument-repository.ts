import type {
  AliasQuery,
  AliasResult,
  Instrument,
  InstrumentAlias,
  InstrumentCandidate,
} from "@portfolio-atlas/contracts";
export interface InstrumentRepository {
  candidate(id: string): InstrumentCandidate | undefined;
  saveCandidate(candidate: InstrumentCandidate): void;
  all(): Instrument[];
  get(id: string): Instrument | undefined;
  save(instrument: Instrument): void;
}
export interface IdentityResolver {
  resolve(query: AliasQuery, aliases: InstrumentAlias[]): AliasResult;
}
