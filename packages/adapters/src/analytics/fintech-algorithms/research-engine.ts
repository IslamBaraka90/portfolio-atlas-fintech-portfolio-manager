import { z } from "zod";
import { calculateSma } from "fintech-algorithms/technical-indicators/trend-smoothing/sma";
import { commonSizeStatements } from "fintech-algorithms/fundamental-analysis-and-valuation/statement-ratios/common-size-statements";
import { calculateNetAdvances } from "fintech-algorithms/market-breadth-and-internals/advance-decline-breadth/net-advances";
import type {
  CompanyObservation,
  CompanyPeriod,
  FundamentalObservation,
  ResearchRequest,
  TrendObservation,
  BreadthObservation,
} from "@portfolio-atlas/contracts";
import type { ResearchEngine, ResearchSource, ResearchCalculation } from "@portfolio-atlas/core";

// The installed optimized SMA rejects null despite the catalog summary. Run it
// on contiguous valid segments and restore their original slots; never join gaps.
export function alignedSma(values: (number | null)[], window: number): (number | null)[] {
  const output: (number | null)[] = values.map(() => null);
  let start = 0;
  while (start < values.length) {
    if (values[start] === null) {
      start++;
      continue;
    }
    let end = start;
    const segment: number[] = [];
    while (end < values.length && values[end] !== null) segment.push(values[end++]!);
    calculateSma(segment, window).forEach((value, i) => {
      output[start + i] = value;
    });
    start = end;
  }
  return output;
}
function trend(request: ResearchRequest, { dataset, run }: ResearchSource): TrendObservation {
  const reasons: string[] = [];
  const accepted = new Set(dataset.quality.acceptedIndexes);
  const basis = run ? "split_adjusted" : "unadjusted_no_actions";
  const knownAt = [dataset.observedAt, ...(run ? [run.createdAt, run.actionKnowledgeAt] : [])]
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .at(-1)!;
  if (Date.parse(knownAt) > Date.parse(request.asOf))
    reasons.push("Price or adjustment evidence was observed after the cutoff.");
  if (request.purpose === "historical_strategy")
    reasons.push("Current reconstructed prices do not establish point-in-time availability.");
  if (dataset.basis !== "synthetic_unadjusted" || dataset.source !== "synthetic")
    reasons.push(
      "Share basis and corporate-action completeness are not proven for this provider history.",
    );
  if (!run && dataset.request.scenario !== "clean")
    reasons.push("Use a reviewed adjustment run for histories outside the no-action fixture.");
  if (
    run &&
    (run.status !== "ready" ||
      run.datasetId !== dataset.id ||
      run.datasetRevision !== dataset.revision ||
      run.sourceHash !== dataset.sourceHash)
  )
    reasons.push("Adjustment run is not ready or does not match the exact dataset revision.");
  if (
    dataset.quality.coverage.expectedSessions === null ||
    dataset.quality.coverage.missingSessions.length
  )
    reasons.push(
      "Session coverage is unknown or has gaps; a moving window must not silently compress time.",
    );
  const rows = dataset.rows.map((row, i) => {
    const adjusted = run?.series.find(
      (r) => r.sourceRowId === row.rowId && r.date === row.sessionDate,
    );
    const close =
      accepted.has(i) && row.timestamp && Date.parse(row.timestamp) <= Date.parse(request.asOf)
        ? run
          ? (adjusted?.splitAdjustedClose ?? null)
          : row.close === null || dataset.quoteUnit.scaleToCurrency === null
            ? null
            : row.close * dataset.quoteUnit.scaleToCurrency
        : null;
    return {
      sourceRowId: row.rowId,
      timestamp: row.timestamp,
      sessionDate: row.sessionDate,
      close: close !== null && Number.isFinite(close) && close > 0 && close <= 1e12 ? close : null,
      sma: null as number | null,
      state: "unavailable" as "ready" | "warmup" | "unavailable",
    };
  });
  if (!rows.length) reasons.push("No observations exist.");
  const dates = rows.map((r) => r.sessionDate);
  if (dates.some((date, i) => date === null || (i > 0 && date <= (dates[i - 1] ?? ""))))
    reasons.push("Sessions must be unique and strictly ordered.");
  if (!reasons.length) {
    const sma = alignedSma(
      rows.map((r) => r.close),
      request.window,
    );
    if (sma.length !== rows.length) throw new Error("SMA output lost row alignment.");
    rows.forEach((row, i) => {
      row.sma = sma[i] ?? null;
      row.state =
        row.close === null
          ? "unavailable"
          : i < request.window - 1
            ? "warmup"
            : row.sma === null
              ? "unavailable"
              : "ready";
    });
  }
  const latest = rows.at(-1);
  return {
    instrumentId: dataset.instrument.instrumentId,
    dataset: { id: dataset.id, revision: dataset.revision },
    adjustmentRun: run ? { id: run.id, revision: run.revision } : null,
    basis: reasons.length ? "unavailable" : basis,
    knownAt,
    status: reasons.length ? "unavailable" : "ready",
    reasons,
    rows,
    latestRelation:
      !reasons.length && latest?.close !== null && latest?.sma != null
        ? latest!.close! > latest.sma
          ? "above"
          : latest!.close! < latest.sma
            ? "below"
            : "equal"
        : null,
    warmupSlots: Math.min(request.window - 1, rows.length),
  };
}
function fundamentals(
  request: ResearchRequest,
  instrumentId: string,
  company?: CompanyObservation,
): FundamentalObservation {
  const result: FundamentalObservation = {
    instrumentId,
    company: company ? { id: company.id, revision: company.revision } : null,
    status: "unavailable",
    reasons: [],
    periods: [],
    focusPercentage: null,
    focusChangePercentagePoints: null,
    historicalAvailabilityProven: false,
    method: "common_size_income_net_income_share",
    interpretation:
      "Net income as a percentage of revenue, with change in percentage points. This is not a forecast or a buy recommendation.",
  };
  const reject = (reason: string) => {
    result.reasons.push(reason);
    return result;
  };
  if (!company) return reject("No company observation was selected.");
  if (company.instrument.assetType !== "equity")
    return reject("The income-statement diagnostic applies to an operating company.");
  const known = company.periods.filter(
    (p) =>
      Date.parse(p.availableAt) <= Date.parse(request.asOf) &&
      p.periodEnd <= request.asOf.slice(0, 10),
  );
  const periods = new Map<string, CompanyPeriod>();
  for (const period of known) {
    const previous = periods.get(period.periodEnd);
    if (!previous || period.revision > previous.revision) periods.set(period.periodEnd, period);
    else if (period.revision === previous.revision)
      return reject("Ambiguous statement revision for one period.");
  }
  result.periods = [...periods.values()]
    .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))
    .slice(-2);
  result.historicalAvailabilityProven =
    company.source === "synthetic" &&
    result.periods.length === 2 &&
    result.periods.every((p) => p.availabilityBasis === "authored_release");
  if (request.purpose === "historical_strategy" && !result.historicalAvailabilityProven)
    return reject("Observed-now financials cannot establish original historical availability.");
  if (result.periods.length !== 2)
    return reject("Two comparable periods were not available at the cutoff.");
  const [first, last] = result.periods as [CompanyPeriod, CompanyPeriod];
  if (
    result.periods.some((p) => p.reasons.length || p.currency === null || p.periodType === null) ||
    first.currency !== last.currency ||
    first.periodType !== last.periodType
  )
    return reject("Statement periods or currencies are unknown, mixed, or disputed.");
  if (first.periodType !== (company.request.frequency === "annual" ? "12M" : "3M"))
    return reject("Statement periods do not match the requested frequency.");
  const days = (Date.parse(last.periodEnd) - Date.parse(first.periodEnd)) / 86400000;
  if (first.periodType === "12M" ? days < 350 || days > 380 : days < 75 || days > 105)
    return reject("The selected periods are not consecutive at the same reporting frequency.");
  if (
    result.periods.some((p) =>
      Object.values(p.items).some((v) => v === null || !Number.isFinite(v) || Math.abs(v) > 1e15),
    )
  )
    return reject("A required statement value is missing or outside the finite analysis boundary.");
  if (result.periods.some((p) => p.items.revenue! <= 0 || p.items.costOfRevenue! < 0))
    return reject("Positive revenue and a nonnegative expense magnitude are required.");
  const output = z
    .object({
      state: z.literal("calculated"),
      focus_percentage: z.number().finite(),
      focus_change_pp: z.number().finite(),
    })
    .parse(
      commonSizeStatements({
        statement_type: "income",
        base_label: "Revenue",
        focus_label: "Net income",
        periods: result.periods.map((p) => ({
          period: p.periodEnd,
          items: [
            { label: "Revenue", value: p.items.revenue },
            { label: "Cost of revenue", value: p.items.costOfRevenue },
            { label: "Gross profit", value: p.items.grossProfit },
            { label: "Net income", value: p.items.netIncome },
          ],
        })),
      }),
    );
  result.status = "ready";
  result.focusPercentage = output.focus_percentage;
  result.focusChangePercentagePoints = output.focus_change_pp;
  return result;
}
function breadth(request: ResearchRequest, trends: TrendObservation[]): BreadthObservation {
  const dates = [
    ...new Set(
      trends.flatMap((t) =>
        t.rows.map((r) => r.sessionDate).filter((d): d is string => d !== null),
      ),
    ),
  ]
    .sort()
    .slice(-2);
  const result: BreadthObservation = {
    status: "unavailable",
    sessionDate: dates.at(-1) ?? null,
    universeIds: trends.map((t) => t.instrumentId),
    advances: null,
    declines: null,
    unchanged: null,
    unclassified: null,
    coverageRatio: null,
    netAdvances: null,
    reasons: [],
    interpretation: "Participation in the selected teaching universe; not a market-wide measure.",
  };
  if (dates.length !== 2 || dates[1]! > request.asOf.slice(0, 10)) {
    result.reasons.push("Two aligned sessions are required.");
    return result;
  }
  const output = calculateNetAdvances({
    session_date: dates[1]!,
    session_id: "authored-daily-close",
    session_timezone: "UTC",
    venue_id: "selected-teaching-listings",
    universe_id: result.universeIds.join("|"),
    comparison_basis: "comparable-prior-close",
    corporate_action_policy: "explicit-no-action-or-split-adjusted",
    price_tolerance: 0,
    calculation_as_of: request.asOf,
    revisions: [
      {
        revision_id: "frozen-inputs",
        revision_sequence: 1,
        supersedes_revision_id: null,
        effective_at: dates[1] + "T00:00:00Z",
        available_at: request.asOf,
        is_final: true,
        members: trends.map((t) => {
          const current = t.rows.find((r) => r.sessionDate === dates[1])?.close ?? null;
          const prior = t.rows.find((r) => r.sessionDate === dates[0])?.close ?? null;
          const usable = t.status === "ready" && current !== null && prior !== null;
          return {
            listing_id: t.instrumentId,
            security_id: t.instrumentId,
            ticker: null,
            state: usable ? ("eligible" as const) : ("missing_price" as const),
            current_price: usable ? current : null,
            prior_comparable_price: usable ? prior : null,
          };
        }),
      },
    ],
  });
  return {
    ...result,
    status: output.status,
    advances: output.advances,
    declines: output.declines,
    unchanged: output.unchanged,
    unclassified: output.unclassified,
    coverageRatio: output.coverage_ratio,
    netAdvances: output.net_advances,
    reasons: output.diagnostics,
  };
}
export class FintechResearchEngine implements ResearchEngine {
  calculate(
    request: ResearchRequest,
    sources: ResearchSource[],
    companies: CompanyObservation[],
  ): ResearchCalculation {
    const trends = sources.map((source) => trend(request, source));
    return {
      trends,
      fundamentals: sources.map(({ dataset }) =>
        fundamentals(
          request,
          dataset.instrument.instrumentId,
          companies.find((c) => c.instrument.instrumentId === dataset.instrument.instrumentId),
        ),
      ),
      breadth: breadth(request, trends),
      policyVersion: "chapter-7.v1",
      packageVersion: "0.13.2",
      verification: "verified_shared_fixture_parity",
      createsOrders: false,
      warnings: [
        "Shared-fixture parity does not independently validate provider statements.",
        "Current price history is not historical strategy evidence.",
        ...companies.flatMap((c) => c.warnings),
      ],
    };
  }
}
