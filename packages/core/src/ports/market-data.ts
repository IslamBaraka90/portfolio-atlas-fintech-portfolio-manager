import type {
  BarObservation,
  DataMode,
  IngestionRequest,
  Instrument,
  MarketDataset,
  QualityReport,
  QuoteUnit,
} from "@portfolio-atlas/contracts";
import type { ProviderReply } from "./instrument-provider.js";
export interface ChartObservation {
  symbol: string;
  timezone: string | null;
  quoteUnit: QuoteUnit;
  basis: MarketDataset["basis"];
  rows: BarObservation[];
  raw: unknown;
  expectedSessions: string[] | null;
  calendarEvidence: string;
}
export interface ChartProvider {
  readonly mode: DataMode;
  chart(
    instrument: Instrument,
    request: IngestionRequest,
  ): Promise<ProviderReply<ChartObservation>>;
}
export interface RawArchive {
  read(hash: string): Promise<unknown>;
  save(raw: unknown): Promise<{ hash: string; reference: string }>;
}
export interface DatasetRepository {
  all(): MarketDataset[];
  get(id: string, revision?: number): MarketDataset | undefined;
  save(dataset: MarketDataset): void;
}
export interface MarketQualityValidator {
  validate(
    observation: ChartObservation,
    instrument: Instrument,
    request: IngestionRequest,
    observedAt: string,
  ): QualityReport;
}
