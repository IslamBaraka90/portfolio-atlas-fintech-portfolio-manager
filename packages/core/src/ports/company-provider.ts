import type { CompanyPeriod, CompanyRequest, Instrument } from "@portfolio-atlas/contracts";
import type { ProviderReply } from "./instrument-provider.js";
export interface CompanyFacts {
  periods: CompanyPeriod[];
  warnings: string[];
  raw: unknown;
}
export interface CompanyProvider {
  fetch(instrument: Instrument, request: CompanyRequest): Promise<ProviderReply<CompanyFacts>>;
}
