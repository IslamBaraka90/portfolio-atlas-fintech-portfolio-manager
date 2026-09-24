import { useEffect, useState } from "react";
import { z } from "zod";
import {
  valuationSnapshotSchema,
  riskModelSnapshotSchema,
  targetSnapshotSchema,
  monitorSnapshotSchema,
  riskFindingSchema,
  type ValuationSnapshot,
  type RiskModelSnapshot,
  type TargetSnapshot,
  type MonitorSnapshot,
  type RiskFinding,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "../research/research.css";
import "../valuation/valuation.css";
const percent = (n: number | null) => (n === null ? "unavailable" : (n * 100).toFixed(2) + "%");
export function MonitorDesk() {
  const [valuations, setValuations] = useState<ValuationSnapshot[]>([]),
    [models, setModels] = useState<RiskModelSnapshot[]>([]),
    [targets, setTargets] = useState<TargetSnapshot[]>([]),
    [runs, setRuns] = useState<MonitorSnapshot[]>([]),
    [findings, setFindings] = useState<RiskFinding[]>([]);
  const [valuationId, setValuationId] = useState(""),
    [modelId, setModelId] = useState(""),
    [targetId, setTargetId] = useState(""),
    [shock, setShock] = useState("-0.1"),
    [run, setRun] = useState<MonitorSnapshot | null>(null),
    [findingId, setFindingId] = useState(""),
    [actor, setActor] = useState("Risk reviewer"),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function refresh() {
    const [v, m, t, r, f] = await Promise.all([
      read("/valuations", z.array(valuationSnapshotSchema)),
      read("/risk-models", z.array(riskModelSnapshotSchema)),
      read("/targets", z.array(targetSnapshotSchema)),
      read("/monitors", z.array(monitorSnapshotSchema)),
      read("/risk-findings", z.array(riskFindingSchema)),
    ]);
    setValuations(v.data);
    setModels(m.data);
    setTargets(t.data);
    setRuns(r.data);
    setFindings(f.data);
  }
  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
  }, []);
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
  const selected = valuations.find((v) => v.id === valuationId),
    finding = findings.find((f) => f.id === findingId);
  function exposures(title: string, rows: MonitorSnapshot["positions"]) {
    return (
      <div className="chapter-table-wrap">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th>Exposure</th>
              <th>Base value</th>
              <th>NAV weight</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.subject}>
                <td>{r.subject}</td>
                <td>{r.value}</td>
                <td>{percent(r.weight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <LearningShell active={14}>
      <div className="chapter-page research-page">
        <div className="chapter-kicker">CHAPTER 14 · RISK MONITORING</div>
        <h1>Know what needs attention.</h1>
        <p className="chapter-intro">
          Freeze the evidence, compare exposure with limits, and keep a history of each review
          decision.
        </p>
        {error && (
          <div className="chapter-warning" role="alert">
            {error}
          </div>
        )}
        <section className="chapter-panel">
          <h2>Run a portfolio review</h2>
          <div className="chapter-form">
            <label>
              Monitoring valuation
              <select value={valuationId} onChange={(e) => setValuationId(e.target.value)}>
                <option value="">Select latest portfolio valuation</option>
                {valuations.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.request.portfolioId.slice(0, 8)} · {v.request.asOf} · NAV{" "}
                    {v.totals.nav ?? "incomplete"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Historical risk model
              <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
                <option value="">No historical sample</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id.slice(0, 8)} · {m.observations} intervals · {m.request.returnType}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Comparison target
              <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">No target comparison</option>
                {targets
                  .filter((t) => t.request.portfolioId === selected?.request.portfolioId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.request.method} · {t.status} · {t.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Price shock fraction
              <input
                type="number"
                step=".01"
                min="-1"
                max="1"
                value={shock}
                onChange={(e) => setShock(e.target.value)}
              />
            </label>
            <button
              className="primary"
              disabled={busy || !valuationId}
              onClick={() =>
                void act(async () => {
                  const r = (
                    await write(
                      "POST",
                      "/monitors",
                      {
                        valuation: { id: valuationId, revision: 1 },
                        riskModel: modelId ? { id: modelId, revision: 1 } : null,
                        target: targetId ? { id: targetId, revision: 1 } : null,
                        shock: Number(shock),
                      },
                      monitorSnapshotSchema,
                    )
                  ).data;
                  setRun(r);
                  setFindingId("");
                })
              }
            >
              Run risk monitor
            </button>
          </div>
          <p>
            Fixed review thresholds: drift &gt; 5 percentage points, drawdown &gt; 20%, one-interval
            95% VaR &gt; 5%. Current mandate owns concentration and cash limits. Equality passes.
          </p>
          <label>
            Saved risk monitor
            <select
              value={run?.id ?? ""}
              onChange={(e) => {
                setRun(runs.find((r) => r.id === e.target.value) ?? null);
                setFindingId("");
              }}
            >
              <option value="">Select frozen run</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.portfolioId.slice(0, 8)} · {r.createdAt} · {r.fresh ? "fresh" : "unavailable"}
                </option>
              ))}
            </select>
          </label>
        </section>
        {run && (
          <>
            <section className="chapter-panel" data-testid="monitor-result">
              <h2>Evidence: {run.fresh ? "fresh" : "unavailable"}</h2>
              <p>
                Frozen book {run.valuation.book.checkpoint} · mandate r{run.mandate.revision} ·
                valuation {run.valuation.request.asOf}. Freshness is evaluated at run time; create a
                new run for a current decision.
              </p>
              {run.freshnessReasons.map((r) => (
                <p className="chapter-warning" key={r}>
                  {r}
                </p>
              ))}
              {exposures("Economic positions", run.positions)}
              {exposures("Sector concentration", run.sectors)}
              {exposures("Currency exposure including economic cash", run.currencies)}
              <h3>Parallel price shock: {percent(run.request.shock)}</h3>
              <p>
                FX fixed, cash unchanged, linear equity/ETF model. These are hypothetical value
                changes.
              </p>
              <div className="chapter-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Base value</th>
                      <th>Scenario P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.scenario.map((s) => (
                      <tr key={s.subject}>
                        <td>{s.subject}</td>
                        <td>{s.baseValue}</td>
                        <td>{s.change}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p data-testid="scenario-total">
                Current scenario P&amp;L: {run.scenarioTotal ?? "unavailable"}{" "}
                {run.valuation.baseCurrency} · proposed:{" "}
                {run.proposedScenarioTotal ?? "unavailable"}
              </p>
              {run.target?.weights &&
                exposures(
                  "Proposed weights (pre-cost target)",
                  run.target.assetIds.map((id, i) => ({
                    subject: id,
                    value: "pre-cost weight only",
                    weight: run.target!.weights![i]!,
                  })),
                )}
              <h3>Historical loss context</h3>
              <p>{run.history.reason}</p>
              <p>
                Current maximum drawdown: {percent(run.history.maximumDrawdown)} · historical VaR:{" "}
                {percent(run.history.valueAtRisk)} · proposed VaR:{" "}
                {percent(run.proposedHistory?.valueAtRisk ?? null)}
              </p>
              <p>
                95% confidence · one supplied daily interval · linear interpolation at (n−1) × p ·
                losses are negative returns. VaR is not a maximum possible loss.
              </p>
              <LossPlot history={run.history} />
              <details>
                <summary>Exact return and loss sample</summary>
                <p>
                  {run.riskModel?.intervals[0]?.from} to {run.riskModel?.intervals.at(-1)?.to} ·{" "}
                  {run.history.returns.length} observations ·{" "}
                  {run.riskModel?.request.returnBasis ?? "no sample"}
                </p>
                <pre>
                  {JSON.stringify(
                    {
                      returns: run.history.returns,
                      sortedLosses: run.history.losses,
                      positiveDrawdowns: run.history.drawdowns,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
              <h3>Rule observations</h3>
              <div className="chapter-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rule / subject</th>
                      <th>Observed / limit</th>
                      <th>State</th>
                      <th>Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.observations.map((o) => (
                      <tr key={o.key}>
                        <td>
                          {o.rule} · {o.subject}
                        </td>
                        <td>
                          {percent(o.observed)} / {percent(o.limit)}
                        </td>
                        <td>{o.status}</td>
                        <td>{o.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul>
                {run.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </section>
            <section className="chapter-panel">
              <h2>Finding lifecycle</h2>
              <p>
                Acknowledgment records ownership. Resolution requires a fresh passing observation
                from the latest run; a missing or stale result cannot clear risk.
              </p>
              <label>
                Risk finding
                <select value={findingId} onChange={(e) => setFindingId(e.target.value)}>
                  <option value="">Select finding</option>
                  {findings
                    .filter((f) => f.portfolioId === run.portfolioId)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.rule} · {f.subject} · {f.status} · {f.observation.status}
                      </option>
                    ))}
                </select>
              </label>
              {finding && (
                <div data-testid="finding-detail">
                  <h3>Finding: {finding.status}</h3>
                  <p>
                    {finding.rule} · {finding.subject} · {finding.observation.status} · r
                    {finding.revision}
                  </p>
                  <div className="chapter-form">
                    <label>
                      Review actor
                      <input value={actor} onChange={(e) => setActor(e.target.value)} />
                    </label>
                    <label>
                      Review reason
                      <input value={reason} onChange={(e) => setReason(e.target.value)} />
                    </label>
                    {(["acknowledge", "escalate", "resolve"] as const).map((action) => (
                      <button
                        key={action}
                        className="secondary"
                        disabled={busy || finding.status === "resolved"}
                        onClick={() =>
                          void act(async () => {
                            await write(
                              "POST",
                              "/risk-findings/" + finding.id + "/actions",
                              { expectedRevision: finding.revision, action, actor, reason },
                              riskFindingSchema,
                            );
                          })
                        }
                      >
                        {action === "acknowledge"
                          ? "Acknowledge finding"
                          : action === "escalate"
                            ? "Escalate finding"
                            : "Resolve finding"}
                      </button>
                    ))}
                  </div>
                  <ol>
                    {finding.history.map((h, i) => (
                      <li key={i}>
                        {h.at} · {h.action} · {h.actor} · {h.reason}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </LearningShell>
  );
}
function LossPlot({ history }: { history: MonitorSnapshot["history"] }) {
  if (history.status !== "available") return <p>Loss distribution unavailable.</p>;
  const low = Math.min(0, ...history.losses),
    high = Math.max(0, ...history.losses),
    width = high - low || 1;
  const x = (n: number) => 40 + (520 * (n - low)) / width;
  return (
    <figure>
      <svg
        viewBox="0 0 600 115"
        role="img"
        aria-label="Sorted historical losses and 95 percent VaR"
      >
        <line className="chart-grid" x1="40" x2="560" y1="55" y2="55" />
        {history.losses.map((n, i) => (
          <circle key={i} cx={x(n)} cy={42 - (i % 3) * 8} r="4" className="chart-series-fill">
            <title>Loss {percent(n)}</title>
          </circle>
        ))}
        {history.valueAtRisk !== null && (
          <line
            x1={x(history.valueAtRisk)}
            x2={x(history.valueAtRisk)}
            y1="12"
            y2="72"
            className="chart-negative"
            strokeWidth="3"
          />
        )}
        <text x="40" y="95" fontSize="14">
          {percent(low)}
        </text>
        <text x="560" y="95" textAnchor="end" fontSize="14">
          {percent(high)}
        </text>
      </svg>
      <figcaption>
        Dots: observed losses. Highlighted line: interpolated 95% quantile. Negative losses are
        gains; these few synthetic observations do not establish a reliable tail forecast.
      </figcaption>
    </figure>
  );
}
