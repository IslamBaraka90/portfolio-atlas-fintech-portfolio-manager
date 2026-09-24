import { BasisDriftLesson } from "./BasisDriftLesson";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  actionReviewSchema,
  adjustmentResultSchema,
  marketDatasetSchema,
  type ActionReview,
  type AdjustmentResult,
  type MarketDataset,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
type View = "providerClose" | "splitAdjustedClose" | "totalReturnClose" | "convertedClose";
const views: { key: View; label: string }[] = [
  { key: "providerClose", label: "Provider prices" },
  { key: "splitAdjustedClose", label: "Split-adjusted" },
  { key: "totalReturnClose", label: "Dividend total return" },
  { key: "convertedClose", label: "FX scenario" },
];
const fmt = (value: number | null) =>
  value === null ? "Unavailable" : value.toLocaleString("en-US", { maximumFractionDigits: 6 });
export function CorporateActionsDesk() {
  const [datasets, setDatasets] = useState<MarketDataset[]>([]),
    [datasetId, setDatasetId] = useState("");
  const [review, setReview] = useState<ActionReview | null>(null),
    [run, setRun] = useState<AdjustmentResult | null>(null);
  const [runs, setRuns] = useState<AdjustmentResult[]>([]),
    [cutoff, setCutoff] = useState("2026-09-09T00:00:00Z"),
    [currency, setCurrency] = useState("EUR");
  const [view, setView] = useState<View>("splitAdjustedClose"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/datasets", z.array(marketDatasetSchema), abort.signal),
      read("/adjustment-runs", z.array(adjustmentResultSchema), abort.signal),
    ])
      .then(([a, b]) => {
        setDatasets(a.data);
        setDatasetId(
          a.data.find((row) => row.request.scenario === "corporate-actions")?.id ??
            a.data[0]?.id ??
            "",
        );
        setRuns(b.data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  function reviewActions() {
    void perform(async () => {
      const dataset = datasets.find((row) => row.id === datasetId);
      if (!dataset) return;
      const result = await write(
        "POST",
        "/corporate-actions/reviews",
        { datasetId, datasetRevision: dataset.revision },
        actionReviewSchema,
      );
      setReview(result.data);
      setRun(null);
    });
  }
  function calculate() {
    void perform(async () => {
      if (!review) return;
      const result = await write(
        "POST",
        "/adjustment-runs",
        { reviewId: review.id, actionKnowledgeAt: cutoff, targetCurrency: currency },
        adjustmentResultSchema,
      );
      setRun(result.data);
      setRuns((items) => [...items.filter((row) => row.id !== result.data.id), result.data]);
    });
  }
  return (
    <LearningShell active={4}>
      <div className="chapter-page">
        <div className="eyebrow">CHAPTER 04 / CORPORATE ACTIONS + FX</div>
        <h1>
          A price move needs
          <br />
          an explanation.
        </h1>
        <p className="chapter-intro">
          Follow a split, a dividend and a currency conversion. Keep the source history intact while
          each research view explains its own assumptions.
        </p>
        {error && (
          <div className="error-banner" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </div>
        )}
        <section className="chapter-panel">
          <h2>01 / Review the action evidence</h2>
          <p className="chapter-muted">
            In <a href="#market-data">Candle quality</a>, ingest AURA with the Split + dividend
            lesson fixture first. The authored history includes an ordinary dividend, its
            correction, and its later cancellation.
          </p>
          <div className="chapter-form">
            <label>
              Parent dataset
              <select
                value={datasetId}
                onChange={(e) => {
                  setDatasetId(e.target.value);
                  setReview(null);
                  setRun(null);
                }}
                disabled={busy}
              >
                <option value="">Choose a saved dataset</option>
                {datasets.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.instrument.returnedSymbol} · {row.request.scenario} · revision{" "}
                    {row.revision}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary" onClick={reviewActions} disabled={busy || !datasetId}>
              {busy ? "Working…" : "Review action evidence"}
            </button>
          </div>
          {review && (
            <>
              <div
                className="chapter-table-wrap"
                tabIndex={0}
                aria-label="Action revision evidence"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Action / revision</th>
                      <th>Terms</th>
                      <th>Effective date</th>
                      <th>Available at</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.actions.map((action) => (
                      <tr key={action.id + ":" + action.revision}>
                        <td>
                          {action.kind}
                          <small>
                            {action.id} · r{action.revision}
                          </small>
                        </td>
                        <td>
                          {action.kind === "split"
                            ? fmt(action.ratio) + " new shares / old share"
                            : fmt(action.amount) + " " + (action.currency ?? "Unknown currency")}
                        </td>
                        <td>{action.effectiveDate ?? "Unknown"}</td>
                        <td>{action.availableAt}</td>
                        <td>
                          {action.status}
                          {action.reasons.map((reason) => (
                            <small key={reason}>{reason}</small>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!review.actions.length && (
                <p>No corporate actions were supplied for this source snapshot.</p>
              )}
              {review.warnings.map((warning) => (
                <p className="chapter-muted" key={warning}>
                  {warning}
                </p>
              ))}
            </>
          )}
        </section>
        {review && (
          <section className="chapter-panel">
            <h2>02 / Choose the action knowledge cutoff</h2>
            <form
              className="chapter-form"
              onSubmit={(event) => {
                event.preventDefault();
                calculate();
              }}
            >
              <label>
                Action knowledge cutoff (UTC)
                <select value={cutoff} onChange={(e) => setCutoff(e.target.value)} disabled={busy}>
                  <option value="2026-09-09T00:00:00Z">September 9 · dividend 2</option>
                  <option value="2026-09-16T00:00:00Z">September 16 · corrected to 2.5</option>
                  <option value="2026-09-21T00:00:00Z">September 21 · cancelled</option>
                </select>
              </label>
              <label>
                Target currency
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={busy}
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Calculating…" : "Build research views"}
              </button>
            </form>
            <p className="chapter-warning">
              Prices come from the current source snapshot. This cutoff controls action revisions
              only; the result is not a historical backtest.
            </p>
          </section>
        )}
        {runs.length > 0 && (
          <section className="chapter-panel">
            <label>
              Saved adjustment run
              <select
                value={run?.id ?? ""}
                onChange={(e) => setRun(runs.find((row) => row.id === e.target.value) ?? null)}
              >
                <option value="">Choose a result</option>
                {runs.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.status} · revision {row.revision} · cutoff{" "}
                    {row.actionKnowledgeAt.slice(0, 10)}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}
        {run && (
          <section className="chapter-panel">
            <h2>03 / Research views: {run.status}</h2>
            {run.reasons.map((reason) => (
              <p className="chapter-warning" key={reason}>
                {reason}
              </p>
            ))}
            {run.series.length > 0 && (
              <>
                <label>
                  Price basis
                  <select
                    aria-label="Price basis"
                    value={view}
                    onChange={(e) => setView(e.target.value as View)}
                  >
                    {views.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="chapter-metrics">
                  <div>
                    <strong>{fmt(run.series[0]![view])}</strong>
                    <span>
                      First observation ·{" "}
                      {view === "convertedClose" ? run.targetCurrency : run.sourceCurrency}
                    </span>
                  </div>
                  <div>
                    <strong>{fmt(run.series.at(-1)![view])}</strong>
                    <span>Last observation</span>
                  </div>
                  <div>
                    <strong>{run.selectedActions.length}</strong>
                    <span>Applied action revisions</span>
                  </div>
                  <div>
                    <strong>{run.revision}</strong>
                    <span>Saved research revision</span>
                  </div>
                </div>
                <AdjustmentChart run={run} view={view} />
                <div
                  className="chapter-table-wrap"
                  tabIndex={0}
                  aria-label="Adjustment factor bridge"
                >
                  <table>
                    <caption>
                      Factor bridge in normalized currency units. Source dataset prices remain
                      unchanged.
                    </caption>
                    <thead>
                      <tr>
                        <th>Session</th>
                        <th>Provider {run.sourceCurrency}</th>
                        <th>Split factor / price</th>
                        <th>Dividend factor / price</th>
                        <th>Converted {run.targetCurrency}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.series.map((row) => (
                        <tr key={row.sourceRowId}>
                          <td>{row.date}</td>
                          <td>{fmt(row.providerClose)}</td>
                          <td>
                            {fmt(row.splitFactor)} × / {fmt(row.splitAdjustedClose)}
                          </td>
                          <td>
                            {fmt(row.dividendFactor)} × / {fmt(row.totalReturnClose)}
                          </td>
                          <td>{fmt(row.convertedClose)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {run.fx && (
              <p className="chapter-warning">
                FX direction: 1 {run.fx.baseCurrency} = {run.fx.quotePerBase} {run.fx.quoteCurrency}
                . USD 100 × 0.90 = EUR 90. {run.fx.source} Observed {run.fx.observedAt}; freshness
                budget {run.fx.maxAgeSeconds}s.
              </p>
            )}
            <h3>Excluded action revisions</h3>
            {run.excludedActions.length ? (
              <ul>
                {run.excludedActions.map((row) => (
                  <li key={row.id + row.revision}>
                    {row.id} · r{row.revision}: {row.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No excluded actions at this cutoff.</p>
            )}
            <dl className="chapter-provenance">
              <div>
                <dt>Immutable parent</dt>
                <dd>
                  <a
                    href={
                      "#market-data?" +
                      new URLSearchParams({
                        dataset: run.datasetId,
                        revision: String(run.datasetRevision),
                      })
                    }
                  >
                    {run.datasetId} · revision {run.datasetRevision}
                  </a>
                </dd>
              </div>
              <div>
                <dt>Price observation time</dt>
                <dd>{run.priceObservedAt}</dd>
              </div>
              <div>
                <dt>Source SHA-256</dt>
                <dd>{run.sourceHash}</dd>
              </div>
              <div>
                <dt>Method / action cutoff</dt>
                <dd>
                  {run.method} / {run.actionKnowledgeAt}
                </dd>
              </div>
            </dl>
            {run.warnings.map((warning) => (
              <p className="chapter-muted" key={warning}>
                {warning}
              </p>
            ))}
          </section>
        )}
        <BasisDriftLesson />
      </div>
    </LearningShell>
  );
}
function AdjustmentChart({ run, view }: { run: AdjustmentResult; view: View }) {
  const values = run.series.map((row) => row[view]),
    finite = values.filter((v): v is number => v !== null);
  const min = finite.length ? Math.min(...finite) : 0,
    max = finite.length ? Math.max(...finite) : 1;
  const x = (index: number) => 35 + (index * 690) / Math.max(1, values.length - 1),
    y = (v: number) => 180 - ((v - min) * 140) / Math.max(1, max - min);
  return (
    <figure className="quality-chart">
      <svg
        viewBox="0 0 760 240"
        role="img"
        aria-label={
          views.find((item) => item.key === view)!.label + " with corporate action markers"
        }
      >
        {values.map((v, index) =>
          v === null ? null : (
            <g key={index}>
              {index > 0 && values[index - 1] !== null && (
                <line
                  x1={x(index - 1)}
                  y1={y(values[index - 1]!)}
                  x2={x(index)}
                  y2={y(v)}
                  className="chart-series"
                  strokeWidth="2"
                />
              )}
              <circle cx={x(index)} cy={y(v)} r="3" className="chart-series-fill" />
              {index % 3 === 0 && (
                <text x={x(index)} y="225" textAnchor="middle">
                  {run.series[index]!.date.slice(5)}
                </text>
              )}
            </g>
          ),
        )}
        {run.selectedActions.map((action) => {
          const index = run.series.findIndex((row) => row.date === action.effectiveDate);
          return index < 0 ? null : (
            <g key={action.id}>
              <line
                x1={x(index)}
                x2={x(index)}
                y1="22"
                y2="195"
                className="chart-accent"
                strokeDasharray="4 5"
              />
              <text x={x(index) + 5} y="20" className="chart-accent-fill">
                {action.kind === "split" ? "Split" : "Dividend"}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        {views.find((item) => item.key === view)!.label} ·{" "}
        {view === "convertedClose" ? run.targetCurrency : run.sourceCurrency} · source snapshot
        unchanged
      </figcaption>
    </figure>
  );
}
