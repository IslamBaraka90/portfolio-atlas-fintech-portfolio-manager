import type { YahooCompanyTransport } from "./company-provider.js";
import { ProviderCalls } from "../provider-calls.js";
import type { YahooChartTransport } from "./chart-provider.js";
import type { YahooQuoteTransport } from "./quote-provider.js";
import YahooFinance from "yahoo-finance2";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import type { QuoteUnit } from "@portfolio-atlas/contracts";
import type {
  CandidateObservation,
  Clock,
  InstrumentObservation,
  InstrumentProvider,
} from "@portfolio-atlas/core";
import { ProviderError, RequestBudget } from "../request-budget.js";

export interface YahooTransport {
  search(query: string, signal: AbortSignal): Promise<unknown>;
  quote(symbol: string, signal: AbortSignal): Promise<unknown>;
}
export function createYahooTransport(): YahooTransport &
  YahooChartTransport &
  YahooCompanyTransport &
  YahooQuoteTransport {
  const context = new AsyncLocalStorage<AbortSignal>();
  const captured = new AsyncLocalStorage<{ source: unknown }>();
  // The constructor fetch hook covers Yahoo cookie/crumb requests too.
  const client = new YahooFinance({
    queue: { concurrency: 2, interval: 250 },
    versionCheck: false,
    suppressNotices: ["yahooSurvey"],
    fetch: async (input, init) => {
      const signal = context.getStore();
      const response = await fetch(input, {
        ...init,
        ...(signal
          ? { signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal }
          : {}),
      });
      const archive = captured.getStore();
      if (archive && String(input).includes("/fundamentals-timeseries/")) {
        archive.source = await response.clone().json();
      }
      return response;
    },
  });
  return {
    financials: (symbol, request, signal) => {
      const archive = { source: null as unknown };
      return captured.run(archive, () =>
        context.run(signal, async () => {
          const rows = await client.fundamentalsTimeSeries(
            symbol,
            {
              period1: request.from,
              period2: request.to,
              type: request.frequency,
              module: "financials",
            },
            { fetchOptions: { signal } },
          );
          return { rows, source: archive.source };
        }),
      );
    },
    chart: (symbol, window, signal) =>
      context.run(signal, () =>
        client.chart(
          symbol,
          {
            period1: window.from,
            period2: window.to,
            interval: "1d",
            return: "array",
            includePrePost: false,
            events: "div,splits",
          },
          { fetchOptions: { signal } },
        ),
      ),
    search: (query, signal) =>
      context.run(signal, () =>
        client.search(query, { quotesCount: 8, newsCount: 0 }, { fetchOptions: { signal } }),
      ),
    quotes: (symbols, signal) =>
      context.run(signal, () =>
        client.quote(
          symbols,
          { return: "array" },
          { fetchOptions: { signal }, validateResult: false },
        ),
      ),
    quote: (symbol, signal) =>
      context.run(signal, () => client.quote(symbol, {}, { fetchOptions: { signal } })),
  };
}
const searchSchema = z.object({
  quotes: z.array(
    z
      .object({
        isYahooFinance: z.boolean(),
        symbol: z.string().optional(),
        quoteType: z.string().optional(),
        shortname: z.string().optional(),
        longname: z.string().optional(),
        exchange: z.string().optional(),
      })
      .passthrough(),
  ),
});
const quoteSchema = z
  .object({
    symbol: z.string(),
    quoteType: z.string().optional(),
    shortName: z.string().optional(),
    longName: z.string().optional(),
    exchange: z.string().optional(),
    exchangeTimezoneName: z.string().optional(),
    currency: z.string().optional(),
    regularMarketTime: z.date().optional(),
  })
  .passthrough();

export function quoteUnit(reported: string | undefined): QuoteUnit {
  if (reported === "GBp" || reported === "GBX")
    return {
      reported,
      currency: "GBP",
      scaleToCurrency: 0.01,
      evidence: "Explicit adapter subunit mapping: pence to pounds (0.01).",
    };
  if (reported && ["USD", "EUR", "GBP", "EGP", "SAR"].includes(reported))
    return {
      reported,
      currency: reported,
      scaleToCurrency: 1,
      evidence: "Recognized provider quote currency; price is per reported instrument unit.",
    };
  return {
    reported: reported ?? null,
    currency: null,
    scaleToCurrency: null,
    evidence: "Currency/unit code is not established by this adapter.",
  };
}
function assetType(value: string | undefined): InstrumentObservation["assetType"] {
  return value === "EQUITY"
    ? "equity"
    : value === "ETF"
      ? "etf"
      : value
        ? "unsupported"
        : "unknown";
}
export class YahooInstrumentProvider extends ProviderCalls implements InstrumentProvider {
  readonly mode = "yahoo" as const;
  constructor(
    private readonly transport: YahooTransport,
    clock: Clock,
    budget = new RequestBudget(),
    ttlMs = 60_000,
  ) {
    super("yahoo", clock, budget, ttlMs);
  }
  search(query: string) {
    return this.call<CandidateObservation[]>("search:" + query, async (signal) => {
      const raw = searchSchema.parse(await this.transport.search(query, signal));
      const observedAt = this.clock.now();
      return raw.quotes
        .filter((row) => row.isYahooFinance && row.symbol)
        .map((row) => ({
          providerSymbol: row.symbol!,
          name: row.longname ?? row.shortname ?? row.symbol!,
          observedVenue: row.exchange ?? null,
          assetType: assetType(row.quoteType),
          quoteUnit: quoteUnit(undefined),
          source: this.mode,
          observedAt,
        }));
    });
  }
  observe(symbol: string) {
    return this.call<InstrumentObservation>("quote:" + symbol, async (signal) => {
      const result = await this.transport.quote(symbol, signal);
      if (!result)
        throw new ProviderError({
          code: "NOT_FOUND",
          message: "No quote observation exists for this symbol.",
          retryable: false,
        });
      const raw = quoteSchema.parse(result);
      return {
        name: raw.longName ?? raw.shortName ?? raw.symbol,
        requestedSymbol: symbol,
        returnedSymbol: raw.symbol,
        source: this.mode,
        observedAt: this.clock.now(),
        quoteTime: raw.regularMarketTime?.toISOString() ?? null,
        observedVenue: raw.exchange ?? null,
        venueMic: null,
        timezone: raw.exchangeTimezoneName ?? null,
        quoteUnit: quoteUnit(raw.currency),
        assetType: assetType(raw.quoteType),
        sector: null,
        tickSize: null,
        lotSize: null,
        tradingUnitEvidence: null,
        identityStatus: "provider_observed",
        verifiedIdentity: null,
        warnings: [
          "A provider observation does not establish permanent legal identity.",
          "Exchange MIC, sector and legal tick/lot sizes need independent evidence.",
          "Current Yahoo metadata does not reconstruct historical availability.",
        ],
      };
    });
  }
}
