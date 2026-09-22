import { z } from "zod";
import type { IngestionRequest, Instrument } from "@portfolio-atlas/contracts";
import type { ChartObservation, ChartProvider, Clock } from "@portfolio-atlas/core";
import { ProviderCalls } from "../provider-calls.js";
import { RequestBudget } from "../request-budget.js";
import { quoteUnit } from "./instrument-provider.js";
export interface YahooChartTransport {
  chart(
    symbol: string,
    window: { from: string; to: string },
    signal: AbortSignal,
  ): Promise<unknown>;
}
const chartSchema = z
  .object({
    meta: z
      .object({ symbol: z.string(), currency: z.string(), exchangeTimezoneName: z.string() })
      .passthrough(),
    quotes: z.array(
      z
        .object({
          date: z.date(),
          open: z.number().nullable(),
          high: z.number().nullable(),
          low: z.number().nullable(),
          close: z.number().nullable(),
          volume: z.number().nullable(),
          adjclose: z.number().nullable().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export class YahooChartProvider extends ProviderCalls implements ChartProvider {
  readonly mode = "yahoo" as const;
  constructor(
    private readonly transport: YahooChartTransport,
    clock: Clock,
    budget = new RequestBudget(),
    ttlMs = 60_000,
  ) {
    super("yahoo", clock, budget, ttlMs);
  }
  chart(instrument: Instrument, request: IngestionRequest) {
    return this.call<ChartObservation>(
      JSON.stringify([instrument.returnedSymbol, request.from, request.to]),
      async (signal) => {
        const raw = chartSchema.parse(
          await this.transport.chart(instrument.returnedSymbol, request, signal),
        );
        const formatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: raw.meta.exchangeTimezoneName,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        return {
          symbol: raw.meta.symbol,
          timezone: raw.meta.exchangeTimezoneName,
          quoteUnit: quoteUnit(raw.meta.currency),
          basis: "provider_returned",
          raw,
          expectedSessions: null,
          calendarEvidence:
            "Yahoo response does not supply an authoritative historical session calendar.",
          rows: raw.quotes.map((row, index) => ({
            rowId: "yahoo-row-" + index,
            sourceIndex: index,
            symbol: raw.meta.symbol,
            timestamp: row.date.toISOString(),
            sessionDate: formatter.format(row.date),
            open: row.open,
            high: row.high,
            low: row.low,
            close: row.close,
            volume: row.volume,
            adjustedClose: row.adjclose ?? null,
            finality: "unknown",
            evidence:
              "Current provider download; historical close finality is not independently established.",
          })),
        };
      },
    );
  }
}
