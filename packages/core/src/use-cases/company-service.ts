import {
  companyRequestSchema,
  companyObservationSchema,
  companyIngestionSchema,
  type CompanyRequest,
  type DataMode,
} from "@portfolio-atlas/contracts";
import type { CompanyProvider } from "../ports/company-provider.js";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { RawArchive } from "../ports/market-data.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { InstrumentService } from "./instrument-service.js";
import { Commands, type CommandContext } from "./commands.js";
import { ApplicationError } from "./errors.js";
export class CompanyService {
  constructor(
    private readonly providers: Partial<Record<DataMode, CompanyProvider>>,
    private readonly store: SnapshotRepository,
    private readonly archive: RawArchive,
    private readonly instruments: InstrumentService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
  ) {}
  list() {
    return this.store.all("company-observation").map((v) => companyObservationSchema.parse(v));
  }
  get(id: string, revision?: number) {
    const value = this.store.get("company-observation", id, revision);
    if (!value) throw new ApplicationError("NOT_FOUND", "Company observation revision not found.");
    return companyObservationSchema.parse(value);
  }
  ingest(value: CompanyRequest, context: CommandContext) {
    const request = companyRequestSchema.parse(value);
    return this.commands.executePrepared(
      "company.ingest",
      request,
      context,
      async () => {
        const instrument = this.instruments.get(request.instrumentId);
        if (instrument.revision !== request.instrumentRevision)
          throw new ApplicationError(
            "REVISION_CONFLICT",
            "Instrument changed before statement retrieval.",
          );
        const provider = this.providers[instrument.source];
        if (!provider)
          return () =>
            companyIngestionSchema.parse({
              status: "unavailable",
              observation: null,
              reasons: ["Provider mode is disabled."],
              retryable: false,
            });
        const reply = await provider.fetch(instrument, request);
        if (reply.status !== "available")
          return () =>
            companyIngestionSchema.parse({
              status: "unavailable",
              observation: null,
              reasons: [reply.failure.message],
              retryable: reply.failure.retryable,
            });
        const archived = await this.archive.save(reply.data.raw);
        return () => {
          if (this.instruments.get(request.instrumentId).revision !== request.instrumentRevision)
            throw new ApplicationError(
              "REVISION_CONFLICT",
              "Instrument changed during statement retrieval.",
            );
          const previous = this.list().find(
            (o) => JSON.stringify(o.request) === JSON.stringify(request),
          );
          const observation = companyObservationSchema.parse({
            id: previous?.id ?? this.ids.next(),
            revision: (previous?.revision ?? 0) + 1,
            createdAt: this.clock.now(),
            observedAt: reply.observedAt,
            instrument,
            request,
            source: instrument.source,
            sourceHash: archived.hash,
            archiveRef: archived.reference,
            periods: reply.data.periods,
            warnings: reply.data.warnings,
          });
          this.store.append(
            "company-observation",
            observation.id,
            observation.revision,
            observation,
          );
          return companyIngestionSchema.parse({
            status: "ingested",
            observation,
            reasons: [],
            retryable: false,
          });
        };
      },
      (result) => result.status === "ingested",
    );
  }
}
