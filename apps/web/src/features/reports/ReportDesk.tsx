import { useEffect, useState } from "react";
import { z } from "zod";
import {
  portfolioSchema,
  valuationSnapshotSchema,
  monitorSnapshotSchema,
  performanceSnapshotSchema,
  attributionResultSchema,
  reconciliationRunSchema,
  targetSnapshotSchema,
  reportSnapshotSchema,
  type Portfolio,
  type ValuationSnapshot,
  type MonitorSnapshot,
  type PerformanceSnapshot,
  type AttributionResult,
  type ReconciliationRun,
  type TargetSnapshot,
  type ReportSnapshot,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "../research/research.css";
import "../valuation/valuation.css";
import "./reports.css";
export function ReportDesk() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]),
    [valuations, setValuations] = useState<ValuationSnapshot[]>([]),
    [monitors, setMonitors] = useState<MonitorSnapshot[]>([]),
    [performances, setPerformances] = useState<PerformanceSnapshot[]>([]),
    [attributions, setAttributions] = useState<AttributionResult[]>([]),
    [reconciliations, setReconciliations] = useState<ReconciliationRun[]>([]),
    [targets, setTargets] = useState<TargetSnapshot[]>([]),
    [reports, setReports] = useState<ReportSnapshot[]>([]),
    [history, setHistory] = useState<ReportSnapshot[]>([]);
  const [portfolioId, setPortfolioId] = useState(""),
    [valuationId, setValuationId] = useState(""),
    [monitorId, setMonitorId] = useState(""),
    [performanceId, setPerformanceId] = useState(""),
    [attributionId, setAttributionId] = useState(""),
    [reconId, setReconId] = useState(""),
    [targetId, setTargetId] = useState(""),
    [title, setTitle] = useState("Portfolio management report"),
    [asOf, setAsOf] = useState(new Date().toISOString()),
    [cutoff, setCutoff] = useState(new Date().toISOString()),
    [refs, setRefs] = useState(
      JSON.stringify({ batches: [], research: [], datasets: [] }, null, 2),
    ),
    [supersede, setSupersede] = useState(false),
    [report, setReport] = useState<ReportSnapshot | null>(null),
    [comparisonRevision, setComparisonRevision] = useState(""),
    [actor, setActor] = useState("Report reviewer"),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function refresh() {
    const [p, v, m, f, a, r, t, s] = await Promise.all([
      read("/portfolios", z.array(portfolioSchema)),
      read("/valuations", z.array(valuationSnapshotSchema)),
      read("/monitors", z.array(monitorSnapshotSchema)),
      read("/performance", z.array(performanceSnapshotSchema)),
      read("/attribution", z.array(attributionResultSchema)),
      read("/reconciliations", z.array(reconciliationRunSchema)),
      read("/targets", z.array(targetSnapshotSchema)),
      read("/reports", z.array(reportSnapshotSchema)),
    ]);
    setPortfolios(p.data);
    setValuations(v.data);
    setMonitors(m.data);
    setPerformances(f.data);
    setAttributions(a.data);
    setReconciliations(r.data);
    setTargets(t.data);
    setReports(s.data);
  }
  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
  }, []);
  async function accept(r: ReportSnapshot) {
    setReport(r);
    setHistory((await read("/reports/" + r.id + "/history", z.array(reportSnapshotSchema))).data);
  }
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const valuation = valuations.find((v) => v.id === valuationId),
    comparison = history.find((r) => String(r.revision) === comparisonRevision);
  const ref = (id: string) => (id ? { id, revision: 1 } : null);
  function selectValuation(id: string) {
    setValuationId(id);
    const v = valuations.find((v) => v.id === id);
    if (v) setAsOf(v.request.asOf);
    setMonitorId("");
    setPerformanceId("");
    setAttributionId("");
    setReconId("");
  }
  return (
    <LearningShell active={16}>
      <div className="chapter-page research-page reports-page">
        <div className="report-builder">
          <div className="chapter-kicker">CHAPTER 16 · MANAGEMENT REPORTING</div>
          <h1>One report. Traceable evidence.</h1>
          <p className="chapter-intro">
            Freeze a consistent evidence set. Inspect coverage before approval, then export the same
            revision.
          </p>
        </div>
        {error && (
          <div role="alert" className="chapter-warning report-builder">
            {error}
          </div>
        )}
        <section className="chapter-panel report-builder">
          <h2>Report sources</h2>
          <div className="chapter-form">
            <label>
              Report portfolio
              <select
                value={portfolioId}
                onChange={(e) => {
                  setPortfolioId(e.target.value);
                  selectValuation("");
                  setTargetId("");
                }}
              >
                <option value="">Select portfolio</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Report title
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              Report valuation
              <select value={valuationId} onChange={(e) => selectValuation(e.target.value)}>
                <option value="">No valuation (coverage report)</option>
                {valuations
                  .filter((v) => v.request.portfolioId === portfolioId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.request.asOf} · NAV {v.totals.nav ?? "incomplete"} · {v.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Economic as-of UTC
              <input
                value={asOf}
                readOnly={!!valuation}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </label>
            <label>
              Evidence cutoff UTC
              <input value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
            </label>
            <button className="secondary" onClick={() => setCutoff(new Date().toISOString())}>
              Use current evidence cutoff
            </button>
          </div>
          <details>
            <summary>Optional matching sections</summary>
            <div className="chapter-form">
              <label>
                Report monitor
                <select value={monitorId} onChange={(e) => setMonitorId(e.target.value)}>
                  <option value="">No monitor</option>
                  {monitors
                    .filter((m) => m.valuation.id === valuationId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.createdAt} · {m.fresh ? "fresh" : "unavailable"}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Report performance
                <select
                  value={performanceId}
                  onChange={(e) => {
                    setPerformanceId(e.target.value);
                    setAttributionId("");
                  }}
                >
                  <option value="">No performance</option>
                  {performances
                    .filter((p) => p.valuations.at(-1)?.id === valuationId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.createdAt} · TWR {p.twr.value ?? "unavailable"}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Report attribution
                <select value={attributionId} onChange={(e) => setAttributionId(e.target.value)}>
                  <option value="">No compatible attribution</option>
                  {attributions
                    .filter(
                      (a) =>
                        a.linkage === "compatible" && a.request.performance?.id === performanceId,
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.request.name} · {a.createdAt}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Report reconciliation
                <select value={reconId} onChange={(e) => setReconId(e.target.value)}>
                  <option value="">No matching reconciliation</option>
                  {reconciliations
                    .filter(
                      (r) =>
                        r.portfolioId === portfolioId &&
                        r.book.book.checkpoint === valuation?.book.checkpoint &&
                        Date.parse(r.statement.asOf) === Date.parse(asOf),
                    )
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.statement.sourceRef} · {r.status}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Report target
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">No target</option>
                  {targets
                    .filter((t) => t.request.portfolioId === portfolioId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.request.method} · {t.id.slice(0, 8)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <p>
              These selectors offer sources matching the selected valuation. The server
              independently checks scope, cutoffs and revisions.
            </p>
            <label>
              Additional source references JSON
              <textarea rows={7} value={refs} onChange={(e) => setRefs(e.target.value)} />
            </label>
            <p>
              Each batches/research/datasets entry is an exact reference: id and revision.
              Instrument scope must match holdings, target or orders.
            </p>
          </details>
          <label className="report-check">
            <input
              type="checkbox"
              checked={supersede}
              disabled={!report}
              onChange={(e) => setSupersede(e.target.checked)}
            />
            Supersede the selected latest report revision
          </label>
          <button
            className="primary"
            disabled={busy || !portfolioId}
            onClick={() =>
              void act(async () => {
                const extra = z
                  .object({
                    batches: z.array(z.object({ id: z.string(), revision: z.number() })),
                    research: z.array(z.object({ id: z.string(), revision: z.number() })),
                    datasets: z.array(z.object({ id: z.string(), revision: z.number() })),
                  })
                  .strict()
                  .parse(JSON.parse(refs));
                await accept(
                  (
                    await write(
                      "POST",
                      "/reports",
                      {
                        portfolioId,
                        title,
                        asOf,
                        dataCutoff: cutoff,
                        valuation: ref(valuationId),
                        monitor: ref(monitorId),
                        performance: ref(performanceId),
                        attribution: ref(attributionId),
                        reconciliation: ref(reconId),
                        target: ref(targetId),
                        ...extra,
                        supersedes:
                          supersede && report ? { id: report.id, revision: report.revision } : null,
                      },
                      reportSnapshotSchema,
                    )
                  ).data,
                );
              })
            }
          >
            Generate frozen report
          </button>
          <label>
            Saved report
            <select
              value={report?.id ?? ""}
              onChange={(e) => {
                const r = reports.find((r) => r.id === e.target.value);
                if (r) void act(() => accept(r));
                else setReport(null);
              }}
            >
              <option value="">Select latest report</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.request.title} · r{r.revision} · {r.status}
                </option>
              ))}
            </select>
          </label>
        </section>
        {report && (
          <>
            <section className="chapter-panel report-builder">
              <h2>Revision history and approval</h2>
              <div className="chapter-form">
                <label>
                  View report revision
                  <select
                    value={report.revision}
                    onChange={(e) =>
                      setReport(history.find((r) => r.revision === Number(e.target.value)) ?? null)
                    }
                  >
                    {history.map((r) => (
                      <option key={r.revision} value={r.revision}>
                        r{r.revision} · {r.status} · {r.createdAt}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Compare with revision
                  <select
                    value={comparisonRevision}
                    onChange={(e) => setComparisonRevision(e.target.value)}
                  >
                    <option value="">No comparison</option>
                    {history.map((r) => (
                      <option key={r.revision} value={r.revision}>
                        r{r.revision} · NAV {r.navTie.nav ?? "unavailable"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {comparison && (
                <p>
                  r{comparison.revision} NAV {comparison.navTie.nav ?? "unavailable"} → r
                  {report.revision} NAV {report.navTie.nav ?? "unavailable"}; missing sections{" "}
                  {comparison.coverage.missing} → {report.coverage.missing}. Exact source references
                  remain below each section.
                </p>
              )}
              {report.status === "draft" && (
                <>
                  <div className="chapter-form">
                    <label>
                      Report reviewer
                      <input value={actor} onChange={(e) => setActor(e.target.value)} />
                    </label>
                    <label>
                      Approval reason
                      <input value={reason} onChange={(e) => setReason(e.target.value)} />
                    </label>
                  </div>
                  <label className="report-check">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    Acknowledge every missing section and exception in this revision
                  </label>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      void act(async () => {
                        await accept(
                          (
                            await write(
                              "POST",
                              "/reports/" + report.id + "/approval",
                              {
                                expectedRevision: report.revision,
                                actor,
                                reason,
                                acknowledgeExceptions: ack,
                              },
                              reportSnapshotSchema,
                            )
                          ).data,
                        );
                      })
                    }
                  >
                    Approve frozen report
                  </button>
                </>
              )}
            </section>
            <div className="report-actions">
              <a
                className="secondary"
                href={"/api/v1/reports/" + report.id + "/export.json?revision=" + report.revision}
                download
              >
                Export frozen JSON
              </a>
              <a
                className="secondary"
                href={"/api/v1/reports/" + report.id + "/export.csv?revision=" + report.revision}
                download
              >
                Export spreadsheet CSV
              </a>
              <button className="secondary" onClick={() => window.print()}>
                Print this frozen revision
              </button>
            </div>
            <article className="report-print-root" data-testid="frozen-report">
              <header className="chapter-panel">
                <div className="chapter-kicker">PORTFOLIO ATLAS · MANAGEMENT REPORT</div>
                <h2>{report.request.title}</h2>
                <p>
                  {report.portfolio.name} · {report.currency} · {report.mode} ·{" "}
                  <strong>{report.status}</strong>
                </p>
                <p>
                  Report {report.id} · revision {report.revision}
                  <br />
                  Economic as of {report.request.asOf}
                  <br />
                  Evidence cutoff {report.request.dataCutoff}
                  <br />
                  Created {report.createdAt}
                </p>
                <p>
                  Coverage: {report.coverage.available} available · {report.coverage.exceptions}{" "}
                  exceptions · {report.coverage.missing} missing.
                </p>
                <p data-testid="report-nav">
                  NAV: {report.navTie.nav ?? "unavailable"} {report.currency} · tie:{" "}
                  {report.navTie.status} · residual {report.navTie.residual ?? "unavailable"}.
                </p>
                {report.approval && (
                  <p>
                    Reviewed by {report.approval.actor} at {report.approval.at}:{" "}
                    {report.approval.reason}. Exceptions acknowledged:{" "}
                    {String(report.approval.acknowledgedExceptions)}.
                  </p>
                )}
                <p>
                  Policy {report.policyVersion} · fintech-algorithms {report.packageVersion} ·
                  supersedes {report.supersedes ? "r" + report.supersedes.revision : "none"}.
                </p>
              </header>
              <nav className="report-navigation" aria-label="Report sections">
                {report.sections.map((s) => (
                  <button
                    className="secondary"
                    key={s.key}
                    onClick={() =>
                      document
                        .getElementById("report-section-" + s.key)
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    {s.title}
                  </button>
                ))}
              </nav>
              <section className="chapter-panel">
                <h3>Management observations</h3>
                <ul>
                  {report.insights.map((i) => (
                    <li key={i.id}>
                      <strong>{i.observation}</strong>
                      <p>
                        {i.action}{" "}
                        <a href={i.chapterHash} className="report-actions">
                          Open learning desk
                        </a>
                        <br />
                        As of {i.asOf} · source {i.sourceRef}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
              {report.sections.map((s) => (
                <section
                  className="chapter-panel report-section"
                  id={"report-section-" + s.key}
                  key={s.key}
                >
                  <h3>
                    {s.title} — {s.status}
                  </h3>
                  {s.rows.length > 0 && (
                    <div className="chapter-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th>Measure</th>
                            <th>Value</th>
                            <th>Unit / currency</th>
                            <th>Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.rows.map((r, i) => (
                            <tr key={i}>
                              <td>{r.subject}</td>
                              <td>{r.metric}</td>
                              <td>{r.value ?? "unavailable"}</td>
                              <td>
                                {r.unit} {r.currency}
                              </td>
                              <td>{r.sourceRef}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <ul>
                    {s.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                  <p className="report-lineage">
                    {s.sources
                      .map(
                        (r) =>
                          r.kind +
                          " " +
                          r.id +
                          " r" +
                          r.revision +
                          " · " +
                          r.policyVersion +
                          " · recorded " +
                          r.recordedAt,
                      )
                      .join(" | ") || "No supporting source selected."}
                  </p>
                </section>
              ))}
              <footer className="chapter-panel">
                <h3>Method and coverage limits</h3>
                <ul>
                  {report.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </footer>
            </article>
            <details className="chapter-panel report-builder">
              <summary>Frozen machine-readable evidence</summary>
              <pre>{JSON.stringify(report.evidence, null, 2)}</pre>
            </details>
          </>
        )}
      </div>
    </LearningShell>
  );
}
