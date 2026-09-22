import type {
  DataMode,
  Instrument,
  InstrumentResolution,
  InstrumentSearchResult,
} from "@portfolio-atlas/contracts";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { InstrumentProvider } from "../ports/instrument-provider.js";
import type { InstrumentRepository } from "../ports/instrument-repository.js";
import {
  ApplicationError,
  type CommandContext,
  type PortfolioService,
} from "./portfolio-service.js";
import { Commands } from "./commands.js";
import { evaluateEligibility } from "../domain/instrument-eligibility.js";

export class InstrumentService {
  constructor(
    private readonly providers: Partial<Record<DataMode, InstrumentProvider>>,
    private readonly repository: InstrumentRepository,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
    private readonly portfolios: PortfolioService,
  ) {}
  list() {
    return this.repository.all();
  }
  revisions(id: string) {
    this.get(id);
    return this.repository.revisions(id);
  }
  get(id: string) {
    const instrument = this.repository.get(id);
    if (!instrument)
      throw new ApplicationError("NOT_FOUND", "Instrument not found in this session.");
    return instrument;
  }
  async search(query: string, mode: DataMode): Promise<InstrumentSearchResult> {
    const provider = this.providers[mode];
    if (!provider)
      return {
        status: "unavailable",
        source: mode,
        observedAt: this.clock.now(),
        cache: "none",
        candidates: [],
        failure: {
          code: "DISABLED",
          message: "Yahoo is disabled. Enable YAHOO_ENABLED=true on the server to use live mode.",
          retryable: false,
        },
      };
    const reply = await provider.search(query);
    if (reply.status === "unavailable") return { ...reply, candidates: [] };
    const candidates = reply.data.map((item) => ({ ...item, candidateId: this.ids.next() }));
    candidates.forEach((item) => this.repository.saveCandidate(item));
    return {
      status: "available",
      source: mode,
      observedAt: reply.observedAt,
      cache: reply.cache,
      candidates,
      failure: null,
    };
  }
  resolve(candidateId: string, context: CommandContext): Promise<InstrumentResolution> {
    return this.commands.execute<InstrumentResolution>(
      "instrument.resolve",
      { candidateId },
      context,
      async () => {
        const candidate = this.repository.candidate(candidateId);
        if (!candidate)
          throw new ApplicationError(
            "NOT_FOUND",
            "Search candidate expired or does not exist. Search again.",
          );
        if (Date.parse(this.clock.now()) - Date.parse(candidate.observedAt) > 300_000)
          return {
            status: "unresolved",
            source: candidate.source,
            instrument: null,
            reasons: ["The selected search evidence is older than five minutes. Search again."],
            failure: null,
          };
        const provider = this.providers[candidate.source];
        if (!provider)
          return {
            status: "unavailable",
            source: candidate.source,
            instrument: null,
            reasons: [],
            failure: { code: "DISABLED", message: "This provider is disabled.", retryable: false },
          };
        const reply = await provider.observe(candidate.providerSymbol);
        if (reply.status === "unavailable")
          return {
            status: "unavailable",
            source: candidate.source,
            instrument: null,
            reasons: [],
            failure: reply.failure,
          };
        const observation = reply.data;
        const reasons: string[] = [];
        if (observation.returnedSymbol !== candidate.providerSymbol)
          reasons.push(
            "Requested and returned symbols differ; explicit identity evidence is required.",
          );
        if (candidate.observedVenue && observation.observedVenue !== candidate.observedVenue)
          reasons.push("Search and quote venue observations disagree.");
        if (reasons.length)
          return {
            status: "unresolved",
            source: candidate.source,
            instrument: null,
            reasons,
            failure: null,
          };
        const existing = this.repository
          .all()
          .find(
            (row) =>
              row.source === candidate.source &&
              row.returnedSymbol === candidate.providerSymbol &&
              row.observedVenue === candidate.observedVenue,
          );
        const { verifiedIdentity, ...evidence } = observation;
        const record: Instrument = {
          ...evidence,
          instrumentId: verifiedIdentity?.instrumentId ?? existing?.instrumentId ?? this.ids.next(),
          listingId: verifiedIdentity?.listingId ?? existing?.listingId ?? this.ids.next(),
          issuerId: verifiedIdentity?.issuerId ?? null,
          aliases: verifiedIdentity?.aliases ?? [],
          revision: (existing?.revision ?? 0) + 1,
        };
        this.repository.save(record);
        return {
          status: "resolved",
          source: candidate.source,
          instrument: record,
          reasons: record.warnings,
          failure: null,
        };
      },
      (result) => result.status === "resolved",
    );
  }
  eligibility(input: {
    instrumentId: string;
    instrumentRevision: number;
    mandateId: string;
    mandateRevision: number;
  }) {
    const instrument = this.get(input.instrumentId);
    const mandate = this.portfolios.getMandate(input.mandateId);
    if (
      instrument.revision !== input.instrumentRevision ||
      mandate.revision !== input.mandateRevision
    )
      throw new ApplicationError(
        "REVISION_CONFLICT",
        "Instrument or mandate evidence changed. Reload before evaluating.",
      );
    return evaluateEligibility(instrument, mandate, this.clock.now());
  }
}
