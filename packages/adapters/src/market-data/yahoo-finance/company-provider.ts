import { z } from "zod";
import type { CompanyPeriod, CompanyRequest, Instrument } from "@portfolio-atlas/contracts";
import type { CompanyProvider, Clock, CompanyFacts } from "@portfolio-atlas/core";
import { ProviderCalls } from "../provider-calls.js";
import { RequestBudget, ProviderError } from "../request-budget.js";
export interface YahooCompanyTransport {
  financials(
    symbol: string,
    request: Pick<CompanyRequest, "from" | "to" | "frequency">,
    signal: AbortSignal,
  ): Promise<{ rows: unknown; source: unknown }>;
}
const fields = {
  TotalRevenue: "revenue",
  CostOfRevenue: "costOfRevenue",
  GrossProfit: "grossProfit",
  NetIncome: "netIncome",
} as const;
const sdkFields = {
  revenue: "totalRevenue",
  costOfRevenue: "costOfRevenue",
  grossProfit: "grossProfit",
  netIncome: "netIncome",
} as const;
const itemSchema = z.object({
  asOfDate: z.iso.date(),
  periodType: z.enum(["12M", "3M"]).optional(),
  currencyCode: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  reportedValue: z.object({ raw: z.number().finite().nullable() }).optional(),
});
const rowsSchema = z.array(
  z
    .object({
      TYPE: z.literal("FINANCIALS"),
      date: z.date(),
      periodType: z.enum(["12M", "3M"]).optional(),
    })
    .passthrough(),
);
export function normalizeYahooCompany(
  symbol: string,
  request: CompanyRequest,
  rows: unknown,
  source: unknown,
  observedAt: string,
): CompanyFacts {
  const sdk = rowsSchema.parse(rows),
    raw = z
      .object({ timeseries: z.object({ result: z.array(z.record(z.string(), z.unknown())) }) })
      .parse(source);
  const records = new Map<
    string,
    {
      period: CompanyPeriod;
      currencies: Set<string>;
      types: Set<string>;
      seen: Set<string>;
      missingCurrency: boolean;
    }
  >();
  const prefix = request.frequency === "annual" ? "annual" : "quarterly";
  for (const series of raw.timeseries.result) {
    const meta = z
      .object({ symbol: z.array(z.string()), type: z.array(z.string()) })
      .parse(series.meta);
    const entry = Object.entries(fields).find(([key]) => meta.type.includes(prefix + key));
    if (!entry) continue;
    if (meta.symbol.length !== 1 || meta.symbol[0] !== symbol)
      throw new ProviderError({
        code: "SCHEMA_MISMATCH",
        message: "Statement source symbol does not match the saved instrument.",
        retryable: false,
      });
    const [rawField, field] = entry;
    const items = z.array(itemSchema.nullable()).parse(series[prefix + rawField]);
    for (const item of items) {
      if (!item || item.asOfDate < request.from || item.asOfDate >= request.to) continue;
      let record = records.get(item.asOfDate);
      if (!record) {
        record = {
          period: {
            periodEnd: item.asOfDate,
            periodType: null,
            revision: 1,
            currency: null,
            availableAt: observedAt,
            availabilityBasis: "observed_now",
            sourceRef: "yahoo:financials:" + prefix + ":" + item.asOfDate,
            items: { revenue: null, costOfRevenue: null, grossProfit: null, netIncome: null },
            reasons: [],
          },
          currencies: new Set(),
          types: new Set(),
          seen: new Set(),
          missingCurrency: false,
        };
        records.set(item.asOfDate, record);
      }
      if (item.currencyCode) record.currencies.add(item.currencyCode);
      else record.missingCurrency = true;
      if (item.periodType) record.types.add(item.periodType);
      else record.period.reasons.push("Source period type is missing.");
      const value = item.reportedValue?.raw ?? null;
      if (record.seen.has(field) && record.period.items[field] !== value) {
        record.period.items[field] = null;
        record.period.reasons.push("Conflicting source values for " + field + ".");
      } else record.period.items[field] = value;
      record.seen.add(field);
      const normalized = sdk.find((row) => row.date.toISOString().slice(0, 10) === item.asOfDate);
      const sdkValue = normalized?.[sdkFields[field]];
      // The installed SDK drops zero fields. Preserve the raw zero; never infer it.
      if (value !== null && value !== 0 && sdkValue !== value)
        record.period.reasons.push("Raw and SDK values disagree for " + field + ".");
    }
  }
  const periods = [...records.values()]
    .map((r) => {
      r.period.currency =
        r.currencies.size === 1 && !r.missingCurrency ? [...r.currencies][0]! : null;
      r.period.periodType = r.types.size === 1 ? ([...r.types][0] as "12M" | "3M") : null;
      if (r.period.currency === null)
        r.period.reasons.push("Reporting currencies are missing or inconsistent.");
      if (r.period.periodType === null)
        r.period.reasons.push("Reporting period types are missing or inconsistent.");
      return r.period;
    })
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  return {
    periods,
    warnings: [
      "Current Yahoo observations do not establish original filing publication or revision availability.",
      "Period ends and reporting currencies are provider labels, not independently verified issuer filings.",
      "Original timeseries JSON preserves currency and explicit zero values omitted by SDK normalization.",
    ],
    raw: { sdkRows: JSON.parse(JSON.stringify(rows)), source },
  };
}
export class YahooCompanyProvider extends ProviderCalls implements CompanyProvider {
  constructor(
    private readonly transport: YahooCompanyTransport,
    clock: Clock,
    budget = new RequestBudget(),
  ) {
    super("yahoo", clock, budget, 60000);
  }
  fetch(instrument: Instrument, request: CompanyRequest) {
    return this.call<CompanyFacts>(
      "company:" + instrument.returnedSymbol + ":" + JSON.stringify(request),
      async (signal) => {
        if (request.scenario !== "standard")
          throw new ProviderError({
            code: "SCHEMA_MISMATCH",
            message: "Authored scenarios are available only in synthetic mode.",
            retryable: false,
          });
        if (instrument.assetType !== "equity")
          return {
            periods: [],
            warnings: ["This panel requires company equity statements."],
            raw: { unsupportedAsset: instrument.assetType },
          };
        const { rows, source } = await this.transport.financials(
          instrument.returnedSymbol,
          request,
          signal,
        );
        return normalizeYahooCompany(
          instrument.returnedSymbol,
          request,
          rows,
          source,
          this.clock.now(),
        );
      },
    );
  }
}
