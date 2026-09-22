import type { IngestionRequest, Instrument } from "@portfolio-atlas/contracts";
import type { ChartProvider, Clock, ProviderReply, ChartObservation } from "@portfolio-atlas/core";
import { lessonBars, lessonSessions } from "@portfolio-atlas/testing";
export class SyntheticChartProvider implements ChartProvider {
  readonly mode = "synthetic" as const;
  constructor(private readonly clock: Clock) {}
  async chart(
    instrument: Instrument,
    request: IngestionRequest,
  ): Promise<ProviderReply<ChartObservation>> {
    const inWindow = (date: string) => date >= request.from && date < request.to;
    // Filter by authored source session, before introducing malformed timestamps.
    const rows = lessonBars(instrument.returnedSymbol, request.scenario === "adversarial").filter(
      (row) => inWindow(lessonSessions[row.sourceIndex]!),
    );
    const data: ChartObservation = {
      symbol: instrument.returnedSymbol,
      timezone: instrument.timezone,
      quoteUnit: instrument.quoteUnit,
      basis: "synthetic_unadjusted",
      rows,
      raw: { fixture: "daily-candles.v1", request, rows },
      expectedSessions: lessonSessions.filter(inWindow),
      calendarEvidence: "Authored September 2026 fixture session ledger v1.",
    };
    return {
      status: "available",
      source: this.mode,
      observedAt: this.clock.now(),
      cache: "fresh",
      data,
    };
  }
}
