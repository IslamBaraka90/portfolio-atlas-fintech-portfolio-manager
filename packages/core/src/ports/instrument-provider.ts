import type {
  DataMode,
  Instrument,
  InstrumentCandidate,
  ProviderFailure,
} from "@portfolio-atlas/contracts";

export type ProviderReply<T> =
  | {
      status: "available";
      source: DataMode;
      observedAt: string;
      cache: "fresh" | "hit";
      data: T;
    }
  | {
      status: "unavailable";
      source: DataMode;
      observedAt: string;
      cache: "none";
      failure: ProviderFailure;
    };
export type CandidateObservation = Omit<InstrumentCandidate, "candidateId">;
export type InstrumentObservation = Omit<
  Instrument,
  "instrumentId" | "listingId" | "issuerId" | "revision" | "aliases"
> & {
  verifiedIdentity: Pick<Instrument, "instrumentId" | "listingId" | "issuerId" | "aliases"> | null;
};
export interface InstrumentProvider {
  readonly mode: DataMode;
  search(query: string): Promise<ProviderReply<CandidateObservation[]>>;
  observe(symbol: string): Promise<ProviderReply<InstrumentObservation>>;
}
