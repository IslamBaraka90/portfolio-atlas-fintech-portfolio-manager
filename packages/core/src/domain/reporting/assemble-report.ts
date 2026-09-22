import type {
  ReportRequest,
  ReportEvidence,
  ReportSection,
  ReportSnapshot,
  Portfolio,
} from "@portfolio-atlas/contracts";
import { BookDecimal as D, signedMoney } from "../accounting/decimal.js";
import { ApplicationError } from "../../use-cases/errors.js";
export function assembleReport(
  id: string,
  request: ReportRequest,
  evidence: ReportEvidence,
  portfolio: Portfolio,
) {
  const sections: ReportSection[] = [],
    currency = portfolio.baseCurrency,
    insights: ReportSnapshot["insights"] = [];
  const source = (
    kind: string,
    v: {
      id: string;
      revision?: number;
      createdAt: string;
      updatedAt?: string;
      policyVersion?: string;
    },
    policy?: string,
  ) => ({
    kind,
    id: v.id,
    revision: v.revision ?? 1,
    policyVersion: policy ?? v.policyVersion ?? "frozen_source",
    recordedAt: v.updatedAt ?? v.createdAt,
  });
  const row = (
    subject: string,
    metric: string,
    value: string | number | null,
    unit: string,
    ref: string,
    c: string | null = currency,
  ) => ({
    subject,
    metric,
    value: value === null ? null : String(value),
    unit,
    currency: c,
    sourceRef: ref,
  });
  function section(
    key: string,
    title: string,
    sources: ReportSection["sources"],
    rows: ReportSection["rows"],
    notes: string[],
    exceptions = false,
  ) {
    sections.push({
      key,
      title,
      status: sources.length ? (exceptions ? "exceptions" : "available") : "missing",
      asOf: request.asOf,
      sources,
      rows,
      notes,
    });
  }
  const v = evidence.valuation;
  let navTie: ReportSnapshot["navTie"] = {
    status: "unavailable",
    holdings: null,
    economicCash: null,
    nav: null,
    residual: null,
  };
  if (
    v?.status === "complete" &&
    v.totals.nav !== null &&
    v.positions.every((p) => p.marketValueBase !== null) &&
    v.cash.every((c) => c.baseAmount !== null)
  ) {
    const holdings = v.positions.reduce((s, p) => s.plus(p.marketValueBase!), new D(0)),
      cash = v.cash.reduce((s, c) => s.plus(c.baseAmount!), new D(0)),
      residual = new D(v.totals.nav).minus(holdings).minus(cash);
    if (!residual.isZero())
      throw new ApplicationError(
        "BOOK_INVARIANT",
        "Report holdings plus economic cash do not equal frozen NAV.",
      );
    navTie = {
      status: "reconciled",
      holdings: signedMoney(holdings),
      economicCash: signedMoney(cash),
      nav: v.totals.nav,
      residual: signedMoney(residual),
    };
  }
  section(
    "overview",
    "Management overview",
    [source("portfolio", portfolio, "chapter-1.v1")],
    [
      row(portfolio.name, "NAV", v?.totals.nav ?? null, "money", v?.id ?? id),
      row(portfolio.name, "Holdings", navTie.holdings, "money", v?.id ?? id),
      row(portfolio.name, "Economic cash", navTie.economicCash, "money", v?.id ?? id),
      row(portfolio.name, "NAV residual", navTie.residual, "money", v?.id ?? id),
    ],
    [
      "NAV uses the selected valuation only; missing NAV is never zero.",
      "Economic cash includes receivables less payables; do not subtract pending liabilities twice.",
    ],
    navTie.status !== "reconciled",
  );
  section(
    "holdings",
    "Holdings and cash",
    v ? [source("valuation", v)] : [],
    v
      ? [
          ...v.positions.flatMap((p) => [
            row(p.instrumentId, "Economic shares", p.quantity, "shares", v.id, null),
            row(p.instrumentId, "Market value", p.marketValueBase, "money", v.id),
          ]),
          ...v.cash.map((c) =>
            row(c.currency, "Economic cash in base", c.baseAmount, "money", v.id),
          ),
          ...v.book.cash.flatMap((c) => [
            row(c.currency, "Settled cash", c.settled, "money", v.id, c.currency),
            row(c.currency, "Pending net", c.pending, "money", v.id, c.currency),
            row(c.currency, "Available cash", c.available, "money", v.id, c.currency),
          ]),
        ]
      : [],
    v ? v.warnings : ["No valuation selected."],
    v?.status === "incomplete",
  );
  section(
    "quality",
    "Market-data quality",
    evidence.datasets.map((d) => source("dataset", d, d.quality.policyVersion)),
    evidence.datasets.flatMap((d) => [
      row(
        d.instrument.instrumentId,
        "Accepted rows",
        d.quality.acceptedIndexes.length,
        "count",
        d.id,
        null,
      ),
      row(
        d.instrument.instrumentId,
        "Quarantined rows",
        d.quality.quarantinedIndexes.length,
        "count",
        d.id,
        null,
      ),
      row(
        d.instrument.instrumentId,
        "Missing sessions",
        d.quality.coverage.missingSessions.length,
        "count",
        d.id,
        null,
      ),
      row(d.instrument.instrumentId, "Source hash", d.sourceHash, "sha256", d.id, null),
    ]),
    ["Selected immutable datasets only; absence does not imply clean market data."],
    evidence.datasets.some(
      (d) =>
        d.quality.quarantinedIndexes.length > 0 || d.quality.coverage.missingSessions.length > 0,
    ),
  );
  section(
    "research",
    "Research context",
    evidence.research.map((r) => source("research", r)),
    evidence.research.flatMap((r) => [
      ...r.trends.map((t) =>
        row(t.instrumentId, "Latest relation to SMA", t.latestRelation, "observation", r.id, null),
      ),
      ...r.fundamentals.map((f) =>
        row(f.instrumentId, "Net income share", f.focusPercentage, "percent", r.id, null),
      ),
    ]),
    [
      "Descriptive earlier research; no causal return or trading advice is inferred.",
      ...evidence.research.flatMap((r) => r.warnings),
    ],
    evidence.research.some(
      (r) =>
        r.trends.some((t) => t.status !== "ready") ||
        r.fundamentals.some((f) => f.status !== "ready"),
    ),
  );
  const target = evidence.target;
  section(
    "construction",
    "Construction decision",
    target ? [source("target", target)] : [],
    target
      ? target.assetIds.map((a, i) =>
          row(a, "Proposed weight", target.weights?.[i] ?? null, "fraction", target.id, null),
        )
      : [],
    target
      ? ["Pre-cost target, not executed holdings.", ...target.reasons, ...target.warnings]
      : ["No target selected."],
    target !== null && target.status !== "proposal",
  );
  section(
    "orders",
    "Paper orders",
    evidence.batches.map((b) => source("paper-batch", b)),
    evidence.batches.flatMap((b) =>
      b.orders.flatMap((o) => [
        row(o.clientOrderId, "State", o.state, "state", b.id, null),
        row(o.clientOrderId, "Filled shares", o.filledQuantity, "shares", b.id, null),
        row(o.clientOrderId, "Remaining shares", o.remainingQuantity, "shares", b.id, null),
        row(o.clientOrderId, "Fees", o.fees, "money", b.id),
      ]),
    ),
    ["Paper execution only; selected batch revisions may predate the report."],
    evidence.batches.some((b) => b.status === "active"),
  );
  const recon = evidence.reconciliation;
  section(
    "operations",
    "Custody and reconciliation",
    recon ? [source("reconciliation", recon)] : [],
    recon
      ? [
          row("Custodian comparison", "Status", recon.status, "state", recon.id, null),
          row("Custodian comparison", "Break count", recon.breaks.length, "count", recon.id, null),
          ...recon.breaks.map((b) =>
            row(
              b.subject,
              b.category,
              b.expected + " / " + b.observed,
              "book / statement",
              recon.id,
              null,
            ),
          ),
          ...recon.book.book.settlements.map((s) =>
            row(s.instrumentId, "Pending " + s.side, s.remainingQuantity, "shares", recon.id, null),
          ),
        ]
      : [],
    recon
      ? recon.warnings
      : ["No same-cutoff reconciliation selected; custody agreement is unproven."],
    recon?.status === "breaks",
  );
  const monitor = evidence.monitor;
  section(
    "risk",
    "Risk monitoring",
    monitor ? [source("monitor", monitor)] : [],
    monitor
      ? monitor.observations.map((o) =>
          row(o.subject, o.rule, o.observed, "fraction", monitor.id, null),
        )
      : [],
    monitor
      ? [...monitor.freshnessReasons, ...monitor.warnings]
      : ["No matching monitor selected."],
    monitor !== null && (!monitor.fresh || monitor.observations.some((o) => o.status !== "pass")),
  );
  const performance = evidence.performance;
  section(
    "performance",
    "Performance",
    performance ? [source("performance", performance)] : [],
    performance
      ? [
          row(
            "Portfolio",
            "Net period TWR",
            performance.twr.value,
            "fraction",
            performance.id,
            null,
          ),
          row(
            "Portfolio",
            "Modified Dietz approximation",
            performance.modifiedDietz.value,
            "fraction",
            performance.id,
            null,
          ),
          row(
            "Portfolio",
            "Money-weighted period return",
            performance.moneyWeighted.periodReturn,
            "fraction",
            performance.id,
            null,
          ),
          row(
            "Portfolio",
            "Investment profit",
            performance.investmentProfit,
            "money",
            performance.id,
          ),
        ]
      : [],
    performance
      ? [
          performance.twr.reason,
          performance.modifiedDietz.reason,
          performance.moneyWeighted.reason,
          ...performance.warnings,
        ]
      : ["No ending-valuation-matched performance selected."],
    performance !== null && performance.twr.status !== "available",
  );
  const attribution = evidence.attribution;
  section(
    "attribution",
    "Attribution",
    attribution ? [source("attribution", attribution)] : [],
    attribution
      ? [
          row(
            attribution.request.name,
            "Active return",
            attribution.activeReturn,
            "fraction",
            attribution.id,
            null,
          ),
          row(
            attribution.request.name,
            "Allocation",
            attribution.allocation,
            "fraction",
            attribution.id,
            null,
          ),
          row(
            attribution.request.name,
            "Selection",
            attribution.selection,
            "fraction",
            attribution.id,
            null,
          ),
          row(
            attribution.request.name,
            "Interaction",
            attribution.interaction,
            "fraction",
            attribution.id,
            null,
          ),
          row(
            attribution.request.name,
            "Residual",
            attribution.residual,
            "fraction",
            attribution.id,
            null,
          ),
        ]
      : [],
    attribution
      ? [...attribution.linkageReasons, ...attribution.warnings]
      : ["No compatible performance-linked attribution selected."],
    attribution !== null && (!attribution.reconciled || attribution.linkage !== "compatible"),
  );
  const hashes: Record<string, string> = {
    overview: "#valuation",
    holdings: "#book",
    quality: "#market-data",
    research: "#research",
    construction: "#construction",
    orders: "#orders",
    operations: "#operations",
    risk: "#monitoring",
    performance: "#performance",
    attribution: "#performance",
  };
  for (const s of sections)
    if (s.status !== "available")
      insights.push({
        id: "insight-" + s.key,
        asOf: request.asOf,
        observation: s.title + " has " + s.status + " in this frozen report.",
        sourceRef: s.sources[0]?.id ?? id + "#" + s.key,
        action: "Review the recorded coverage and source evidence before relying on this section.",
        chapterHash: hashes[s.key]!,
      });
  if (navTie.status === "reconciled")
    insights.unshift({
      id: "insight-nav",
      asOf: request.asOf,
      observation: "Holdings plus economic cash reconcile to NAV with zero cent residual.",
      sourceRef: v!.id,
      action: "Inspect the frozen valuation and journal checkpoint.",
      chapterHash: "#valuation",
    });
  const sources = evidence.datasets.map((d) => d.source);
  const mode: ReportSnapshot["mode"] = sources.includes("yahoo")
    ? sources.includes("synthetic") || !!v
      ? "mixed"
      : "yahoo"
    : "synthetic";
  return {
    sections,
    insights,
    navTie,
    mode,
    coverage: {
      available: sections.filter((s) => s.status === "available").length,
      exceptions: sections.filter((s) => s.status === "exceptions").length,
      missing: sections.filter((s) => s.status === "missing").length,
    },
    warnings: [
      "Educational management report, not a regulatory filing or verified investment track record.",
      "All sections and exports use this immutable revision. Missing evidence remains missing after approval.",
      "Decision context can predate the valuation; each source's recorded time and method are retained.",
      "CSV is spreadsheet-safe text; JSON retains unmodified source values.",
    ],
  };
}
