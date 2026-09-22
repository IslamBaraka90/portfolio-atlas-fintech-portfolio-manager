import { validateBars } from "fintech-algorithms/market-data-engineering/cleaning-and-validation/ohlc-consistency-validator";
import { diagnoseGap } from "fintech-algorithms/market-data-engineering/data-quality/missing-bar-gap-classifier";
import { z } from "zod";
import type {
  IngestionRequest,
  Instrument,
  QualityReport,
  ValidationFinding,
} from "@portfolio-atlas/contracts";
import type { ChartObservation, MarketQualityValidator } from "@portfolio-atlas/core";
export class FintechMarketQualityValidator implements MarketQualityValidator {
  validate(
    data: ChartObservation,
    instrument: Instrument,
    request: IngestionRequest,
    observedAt: string,
  ): QualityReport {
    const scale = data.quoteUnit.scaleToCurrency;
    const unitsMatch =
      data.quoteUnit.currency === instrument.quoteUnit.currency &&
      scale === instrument.quoteUnit.scaleToCurrency;
    const tick = instrument.tickSize;
    // Never allow the upstream optional tickSize default to invent exchange evidence.
    const packageRows =
      tick !== null && scale !== null
        ? validateBars(
            data.rows.map((row) => ({
              bar_id: row.rowId,
              source: instrument.source,
              symbol: row.symbol,
              timestamp: row.timestamp,
              open: row.open,
              high: row.high,
              low: row.low,
              close: row.close,
              volume: row.volume,
            })),
            { tickSize: tick * scale, toleranceTicks: 0, priceScale: scale },
          )
        : null;
    const counts = new Map<string, number>();
    data.rows.forEach((row) => {
      if (row.sessionDate) counts.set(row.sessionDate, (counts.get(row.sessionDate) ?? 0) + 1);
    });
    let previousTime = -Infinity;
    const rows = data.rows.map((row, index) => {
      const findings: ValidationFinding[] = [];
      const add = (code: string, reason: string, severity: "error" | "warning" = "error") =>
        findings.push({ code, reason, severity });
      for (const code of packageRows?.[index]?.issues ?? [])
        add(code, "OHLC validator: " + code.toLowerCase().replaceAll("_", " ") + ".");
      if (tick === null)
        add("UNKNOWN_TICK", "No evidenced tick size; package tolerance validation cannot run.");
      if (scale === null || !data.quoteUnit.currency || !unitsMatch)
        add(
          "UNKNOWN_OR_CHANGED_UNITS",
          "Dataset and instrument currency/scale must be known and agree.",
        );
      if (!data.timezone || data.timezone !== instrument.timezone)
        add(
          "UNKNOWN_OR_CHANGED_TIMEZONE",
          "Instrument and dataset timezone must be known and agree.",
        );
      if (data.symbol !== instrument.returnedSymbol || row.symbol !== instrument.returnedSymbol)
        add("SYMBOL_MISMATCH", "The row does not belong to the selected instrument.");
      if (instrument.identityStatus !== "synthetic_verified")
        add(
          "UNVERIFIED_IDENTITY",
          "Provider symbol identity requires independent listing evidence.",
        );
      const validTime = z.iso.datetime().safeParse(row.timestamp).success;
      const time = validTime ? Date.parse(row.timestamp!) : NaN;
      if (!validTime) add("INVALID_EVENT_TIME", "A valid UTC event timestamp is required.");
      else {
        if (time < Date.parse(request.from) || time >= Date.parse(request.to))
          add("OUTSIDE_WINDOW", "Event falls outside the requested half-open window.");
        if (time > Date.parse(observedAt))
          add("FUTURE_EVENT", "Event time is later than this source observation.");
        if (time < previousTime)
          add("OUT_OF_ORDER", "Source event order moved backwards; rows were not silently sorted.");
        previousTime = Math.max(previousTime, time);
        if (data.timezone) {
          try {
            const date = new Intl.DateTimeFormat("en-CA", {
              timeZone: data.timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }).format(new Date(time));
            if (row.sessionDate !== date)
              add(
                "SESSION_DATE_MISMATCH",
                "Session date disagrees with event time in the reported exchange timezone.",
              );
          } catch {
            add("INVALID_TIMEZONE", "Reported timezone is not a supported IANA zone.");
          }
        }
      }
      if (!row.sessionDate || !z.iso.date().safeParse(row.sessionDate).success)
        add("INVALID_SESSION_DATE", "A valid session date is required.");
      if (row.sessionDate && (counts.get(row.sessionDate) ?? 0) > 1)
        add("DUPLICATE_SESSION", "Every copy of this repeated daily session is quarantined.");
      if (
        data.expectedSessions &&
        row.sessionDate &&
        !data.expectedSessions.includes(row.sessionDate)
      )
        add("OUTSIDE_CALENDAR", "Session is absent from the supplied authored calendar.");
      for (const field of ["open", "high", "low", "close"] as const) {
        const value = row[field];
        if (value === null || !Number.isFinite(value) || value <= 0)
          add(
            "INVALID_PRICE_" + field.toUpperCase(),
            "Equity prices must be finite and positive; no null is filled.",
          );
        else if (scale !== null && !Number.isFinite(value * scale))
          add("SCALED_PRICE_OVERFLOW", "Currency normalization must remain finite.");
      }
      if (row.volume === null)
        add(
          "MISSING_VOLUME",
          "Price-only acceptance does not authorize volume analytics.",
          "warning",
        );
      else if (!Number.isFinite(row.volume) || row.volume < 0)
        add("INVALID_VOLUME", "Volume must be finite and nonnegative when provided.");
      else if (row.volume === 0)
        add(
          "ZERO_VOLUME",
          "Observed zero volume is preserved; absence of trading is not independently proved.",
          "warning",
        );
      if (row.finality !== "final")
        add(
          "SESSION_" + row.finality.toUpperCase(),
          "Daily session finality must be evidenced before analytics.",
        );
      return {
        index,
        rowId: row.rowId,
        accepted: !findings.some((f) => f.severity === "error"),
        findings,
      };
    });
    const missingSessions = (data.expectedSessions ?? [])
      .filter((date) => !counts.has(date))
      .map((sessionDate) => {
        const gap = diagnoseGap({
          timestamp: sessionDate,
          bar_state: "absent",
          session_status: "open",
          halt_status: "unknown",
          heartbeat_status: "unknown",
          sequence_status: "unknown",
          activity_status: "unknown",
          activity_independent: false,
          evidence_ids: [data.calendarEvidence],
        });
        return { sessionDate, classification: gap.classification, reason: gap.reason };
      });
    return {
      policyVersion: "chapter-3.v1",
      acceptedIndexes: rows.filter((r) => r.accepted).map((r) => r.index),
      quarantinedIndexes: rows.filter((r) => !r.accepted).map((r) => r.index),
      rows,
      coverage: {
        expectedSessions: data.expectedSessions?.length ?? null,
        observedSessions: counts.size,
        missingSessions,
        evidence: data.calendarEvidence,
      },
      warnings: [
        ...(data.expectedSessions === null
          ? ["Expected session coverage is unknown without a historical calendar."]
          : []),
        ...(data.rows.length === 0 ? ["No observations returned for this window."] : []),
        "Current download availability is not historical point-in-time evidence.",
        "Accepted rows are not a compressed return series. Later windows must preserve rejected and absent sessions.",
      ],
    };
  }
}
