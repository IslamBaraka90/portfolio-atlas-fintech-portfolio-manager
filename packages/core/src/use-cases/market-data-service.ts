import {
  marketDatasetSchema,
  type DataMode,
  type IngestionRequest,
  type IngestionResult,
} from "@portfolio-atlas/contracts";
import type {
  ChartProvider,
  DatasetRepository,
  MarketQualityValidator,
  RawArchive,
} from "../ports/market-data.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { InstrumentService } from "./instrument-service.js";
import { ApplicationError } from "./errors.js";
import { Commands, type CommandContext } from "./commands.js";
export class MarketDataService {
  constructor(
    private readonly providers: Partial<Record<DataMode, ChartProvider>>,
    private readonly repository: DatasetRepository,
    private readonly archive: RawArchive,
    private readonly quality: MarketQualityValidator,
    private readonly instruments: InstrumentService,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
  ) {}
  list() {
    return this.repository.all();
  }
  get(id: string, revision?: number) {
    const value = this.repository.get(id, revision);
    if (!value) throw new ApplicationError("NOT_FOUND", "Dataset revision not found.");
    return value;
  }
  ingest(request: IngestionRequest, context: CommandContext): Promise<IngestionResult> {
    return this.commands.execute<IngestionResult>(
      "market-data.ingest",
      request,
      context,
      async () => {
        const instrument = this.instruments.get(request.instrumentId);
        if (instrument.revision !== request.instrumentRevision)
          throw new ApplicationError(
            "REVISION_CONFLICT",
            "Instrument changed; reload its evidence.",
          );
        const provider = this.providers[instrument.source];
        if (!provider)
          return {
            status: "unavailable",
            source: instrument.source,
            dataset: null,
            failure: {
              code: "DISABLED",
              message: "This market-data provider is disabled.",
              retryable: false,
            },
          };
        const reply = await provider.chart(instrument, request);
        if (reply.status === "unavailable")
          return {
            status: "unavailable",
            source: instrument.source,
            dataset: null,
            failure: reply.failure,
          };
        const evidence = await this.archive.save(reply.data.raw);
        // Archive first. Failure to preserve source evidence cannot publish a dataset.
        const quality = this.quality.validate(reply.data, instrument, request, reply.observedAt);
        const previous = this.repository
          .all()
          .find(
            (row) =>
              row.instrument.instrumentId === instrument.instrumentId &&
              row.request.from === request.from &&
              row.request.to === request.to &&
              row.request.scenario === request.scenario,
          );
        const dataset = marketDatasetSchema.parse({
          id: previous?.id ?? this.ids.next(),
          revision: (previous?.revision ?? 0) + 1,
          createdAt: this.clock.now(),
          instrument,
          request,
          source: instrument.source,
          observedAt: reply.observedAt,
          cache: reply.cache,
          sourceHash: evidence.hash,
          archiveRef: evidence.reference,
          interval: "1d",
          timezone: reply.data.timezone,
          quoteUnit: reply.data.quoteUnit,
          basis: reply.data.basis,
          availability: "observed_now_not_historical",
          rows: reply.data.rows,
          quality,
        });
        this.repository.save(dataset);
        return { status: "ingested", source: instrument.source, dataset, failure: null };
      },
      (result) => result.status === "ingested",
    );
  }
}
