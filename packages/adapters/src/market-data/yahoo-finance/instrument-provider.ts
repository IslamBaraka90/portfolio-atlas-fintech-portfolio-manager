import YahooFinance from "yahoo-finance2";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";
import type { QuoteUnit } from "@portfolio-atlas/contracts";
import type {
  CandidateObservation,
  Clock,
  InstrumentObservation,
  InstrumentProvider,
  ProviderReply,
} from "@portfolio-atlas/core";
import { ProviderError, RequestBudget } from "../request-budget.js";

export interface YahooTransport {
  search(query: string, signal: AbortSignal): Promise<unknown>;
  quote(symbol: string, signal: AbortSignal): Promise<unknown>;
}
export function createYahooTransport(): YahooTransport {
  const context = new AsyncLocalStorage<AbortSignal>();
  // The constructor fetch hook covers Yahoo cookie/crumb requests too.
  const client = new YahooFinance({
    queue: { concurrency: 2, interval: 250 },
    versionCheck: false,
    suppressNotices: ["yahooSurvey"],
    fetch: (input, init) => {
      const signal = context.getStore();
      return fetch(input, {
        ...init,
        ...(signal
          ? { signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal }
          : {}),
      });
    },
  });
  return {
    search: (query, signal) =>
      context.run(signal, () =>
        client.search(query, { quotesCount: 8, newsCount: 0 }, { fetchOptions: { signal } }),
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
export class YahooInstrumentProvider implements InstrumentProvider {
  readonly mode = "yahoo" as const;
  private readonly cache = new Map<string, { time: number; value: ProviderReply<unknown> }>();
  constructor(
    private readonly transport: YahooTransport,
    private readonly clock: Clock,
    private readonly budget = new RequestBudget(),
    private readonly ttlMs = 60_000,
  ) {}
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
  private async call<T>(
    key: string,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<ProviderReply<T>> {
    const now = Date.parse(this.clock.now());
    const cached = this.cache.get(key);
    if (cached && now >= cached.time && now - cached.time < this.ttlMs)
      return {
        ...(structuredClone(cached.value) as ProviderReply<T>),
        cache: "hit",
      } as ProviderReply<T>;
    try {
      const data = await this.budget.run(operation);
      const value: ProviderReply<T> = {
        status: "available",
        source: this.mode,
        observedAt: this.clock.now(),
        cache: "fresh",
        data,
      };
      // A small bounded cache; eviction never changes the underlying evidence time.
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { time: Date.parse(value.observedAt), value: structuredClone(value) });
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const failure =
        error instanceof ProviderError
          ? error.failure
          : error instanceof z.ZodError ||
              (error instanceof Error && error.name === "FailedYahooValidationError")
            ? {
                code: "SCHEMA_MISMATCH" as const,
                message: "Provider evidence did not match the verified response contract.",
                retryable: false,
              }
            : /429|too many|rate limit/i.test(message)
              ? {
                  code: "THROTTLED" as const,
                  message: "The provider is throttling requests.",
                  retryable: true,
                }
              : {
                  code: "NETWORK" as const,
                  message: "The provider request failed. No synthetic data was substituted.",
                  retryable: true,
                };
      return {
        status: "unavailable",
        source: this.mode,
        observedAt: this.clock.now(),
        cache: "none",
        failure,
      };
    }
  }
}
