import type {
  Clock,
  InstrumentObservation,
  InstrumentProvider,
  ProviderReply,
  CandidateObservation,
} from "@portfolio-atlas/core";
import type { Instrument } from "@portfolio-atlas/contracts";

export class SyntheticInstrumentProvider implements InstrumentProvider {
  readonly mode = "synthetic" as const;
  constructor(
    private readonly instruments: Instrument[],
    private readonly clock: Clock,
  ) {}
  async search(query: string): Promise<ProviderReply<CandidateObservation[]>> {
    const rows = this.instruments.filter((row) =>
      (row.name + " " + row.returnedSymbol).toLowerCase().includes(query.toLowerCase()),
    );
    return {
      status: "available",
      source: this.mode,
      observedAt: this.clock.now(),
      cache: "fresh",
      data: rows.map((row) => ({
        providerSymbol: row.returnedSymbol,
        name: row.name,
        observedVenue: row.observedVenue,
        assetType: row.assetType,
        quoteUnit: row.quoteUnit,
        source: this.mode,
        observedAt: this.clock.now(),
      })),
    };
  }
  async observe(symbol: string): Promise<ProviderReply<InstrumentObservation>> {
    const row = this.instruments.find((row) => row.returnedSymbol === symbol);
    if (!row)
      return {
        status: "unavailable",
        source: this.mode,
        observedAt: this.clock.now(),
        cache: "none",
        failure: {
          code: "NOT_FOUND",
          message: "No synthetic instrument matches this symbol.",
          retryable: false,
        },
      };
    const {
      instrumentId,
      listingId,
      issuerId,
      revision: _revision,
      aliases,
      ...observation
    } = structuredClone(row);
    return {
      status: "available",
      source: this.mode,
      observedAt: this.clock.now(),
      cache: "fresh",
      data: {
        ...observation,
        observedAt: this.clock.now(),
        verifiedIdentity: { instrumentId, listingId, issuerId, aliases },
      },
    };
  }
}
