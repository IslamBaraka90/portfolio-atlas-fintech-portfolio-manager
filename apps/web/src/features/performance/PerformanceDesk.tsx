import { useEffect, useState } from "react";
import { z } from "zod";
import {
  valuationSnapshotSchema,
  benchmarkResultSchema,
  performanceSnapshotSchema,
  attributionResultSchema,
  type ValuationSnapshot,
  type BenchmarkResult,
  type PerformanceSnapshot,
  type AttributionResult,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "../research/research.css";
import "../valuation/valuation.css";
const pct = (v: number | null) => (v === null ? "unavailable" : (v * 100).toFixed(4) + "%");
const example = [
  {
    sector: "TECHNOLOGY",
    portfolioWeight: 0.6,
    benchmarkWeight: 0.5,
    portfolioReturn: 0.12,
    benchmarkReturn: 0.1,
  },
  {
    sector: "HEALTHCARE",
    portfolioWeight: 0.4,
    benchmarkWeight: 0.5,
    portfolioReturn: 0.04,
    benchmarkReturn: 0.05,
  },
];
export function PerformanceDesk() {
  const [valuations, setValuations] = useState<ValuationSnapshot[]>([]),
    [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([]),
    [runs, setRuns] = useState<PerformanceSnapshot[]>([]),
    [attributions, setAttributions] = useState<AttributionResult[]>([]);
  const [portfolioId, setPortfolioId] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [benchmarkId, setBenchmarkId] = useState(""),
    [run, setRun] = useState<PerformanceSnapshot | null>(null),
    [attribution, setAttribution] = useState<AttributionResult | null>(null),
    [sectors, setSectors] = useState(JSON.stringify(example, null, 2)),
    [from, setFrom] = useState("2026-01-01"),
    [to, setTo] = useState("2026-01-31"),
    [link, setLink] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function refresh() {
    const [v, b, r, a] = await Promise.all([
      read("/valuations", z.array(valuationSnapshotSchema)),
      read("/benchmarks", z.array(benchmarkResultSchema)),
      read("/performance", z.array(performanceSnapshotSchema)),
      read("/attribution", z.array(attributionResultSchema)),
    ]);
    setValuations(v.data);
    setBenchmarks(b.data);
    setRuns(r.data);
    setAttributions(a.data);
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
  const ordered = valuations
    .filter((v) => v.request.portfolioId === portfolioId)
    .sort(
      (a, b) =>
        Date.parse(a.request.asOf) - Date.parse(b.request.asOf) ||
        a.book.checkpoint - b.book.checkpoint,
    );
  return (
    <LearningShell active={15}>
      <div className="chapter-page research-page">
        <div className="chapter-kicker">CHAPTER 15 · PERFORMANCE & ATTRIBUTION</div>
        <h1>Separate growth from deposits.</h1>
        <p className="chapter-intro">
          Measure investment results from frozen valuations and recorded flows. Explain both the
          return and the limits of its evidence.
        </p>
        {error && (
          <div role="alert" className="chapter-warning">
            {error}
          </div>
        )}
        <section className="chapter-panel">
          <h2>Choose the valuation path</h2>
          <label>
            Performance portfolio
            <select
              value={portfolioId}
              onChange={(e) => {
                setPortfolioId(e.target.value);
                setSelected([]);
              }}
            >
              <option value="">Select portfolio</option>
              {Array.from(new Set(valuations.map((v) => v.request.portfolioId)), (id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <p>
            Select at least two chronological snapshots. Include every external-flow boundary for
            exact TWR. An immediate single-flow bridge is allowed only when unchanged marks/FX and
            the exact NAV change prove zero observed investment gain.
          </p>
          <div className="chapter-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>As of</th>
                  <th>Checkpoint</th>
                  <th>NAV / currency</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={"Include valuation " + v.id}
                        checked={selected.includes(v.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, v.id]
                              : selected.filter((id) => id !== v.id),
                          )
                        }
                      />
                    </td>
                    <td>{v.request.asOf}</td>
                    <td>{v.book.checkpoint}</td>
                    <td>
                      {v.totals.nav ?? "incomplete"} {v.baseCurrency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            Performance benchmark
            <select value={benchmarkId} onChange={(e) => setBenchmarkId(e.target.value)}>
              <option value="">No benchmark</option>
              {benchmarks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.definition.input.name} · {b.definition.input.returnBasis}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy || selected.length < 2}
            onClick={() =>
              void act(async () => {
                setRun(
                  (
                    await write(
                      "POST",
                      "/performance",
                      {
                        valuations: ordered
                          .filter((v) => selected.includes(v.id))
                          .map((v) => ({ id: v.id, revision: v.revision })),
                        benchmark: benchmarkId ? { id: benchmarkId, revision: 1 } : null,
                      },
                      performanceSnapshotSchema,
                    )
                  ).data,
                );
              })
            }
          >
            Measure performance
          </button>
          <label>
            Saved performance
            <select
              value={run?.id ?? ""}
              onChange={(e) => setRun(runs.find((r) => r.id === e.target.value) ?? null)}
            >
              <option value="">Select immutable result</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.portfolioId.slice(0, 8)} · {r.createdAt} · {pct(r.twr.value)}
                </option>
              ))}
            </select>
          </label>
        </section>
        {run && (
          <section className="chapter-panel" data-testid="performance-result">
            <h2>Net period TWR: {pct(run.twr.value)}</h2>
            <p>{run.twr.reason}</p>
            <p>
              Investment profit: {run.investmentProfit ?? "unavailable"} {run.currency} · net of
              recorded book costs · received cash income, no tax model.
            </p>
            <ReturnCurve run={run} />
            <div className="chapter-table-wrap">
              <table>
                <caption>Flow-aware subperiod evidence</caption>
                <thead>
                  <tr>
                    <th>From / to</th>
                    <th>Beginning / ending NAV</th>
                    <th>External flow</th>
                    <th>Recorded fees</th>
                    <th>Net return</th>
                    <th>Method evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {run.periods.map((p, i) => (
                    <tr key={i}>
                      <td>
                        {p.from}
                        <br />
                        {p.to}
                      </td>
                      <td>
                        {p.begin} / {p.end}
                      </td>
                      <td>{p.externalFlow}</td>
                      <td>{p.fees}</td>
                      <td>{pct(p.netReturn)}</td>
                      <td>{p.reasons.join(" ") || "Flow-boundary interval"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Method comparison</h3>
            <p>
              Fee-added-back arithmetic TWR: {pct(run.feeAddedBackTwr.value)}.{" "}
              {run.feeAddedBackTwr.reason}
            </p>
            <p>
              Modified Dietz: {pct(run.modifiedDietz.value)}. {run.modifiedDietz.reason}
            </p>
            <p>
              Money-weighted period return: {pct(run.moneyWeighted.periodReturn)} ·{" "}
              {run.moneyWeighted.status}. {run.moneyWeighted.reason}
            </p>
            <p>
              Secondary annualized IRR: {pct(run.moneyWeighted.annualizedReturn)} · sign changes{" "}
              {run.moneyWeighted.signChanges} · iterations {run.moneyWeighted.iterations} · residual{" "}
              {run.moneyWeighted.residual ?? "unavailable"}.
            </p>
            <details>
              <summary>Investor flows and solver roots</summary>
              <pre>
                {JSON.stringify(
                  {
                    flows: run.investorFlows,
                    roots: run.moneyWeighted.roots,
                    periodRateBounds: run.moneyWeighted.bounds,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
            <h3>Benchmark: {run.comparison.status}</h3>
            <p>{run.comparison.reason}</p>
            <p>
              Benchmark return {pct(run.comparison.benchmarkReturn)} · active return{" "}
              {pct(run.comparison.activeReturn)}.
            </p>
            <ul>
              {run.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}
        <section className="chapter-panel">
          <h2>One-period sector laboratory</h2>
          <p>
            The authored two-sector example has 8.8% portfolio return and 7.5% benchmark return. Its
            1.3 percentage points of active return must reconcile to allocation, selection and
            interaction. These inputs are not inferred from account holdings.
          </p>
          <div className="chapter-form">
            <label>
              Attribution period from
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Attribution period to
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <label>
            Sector weights and returns JSON
            <textarea rows={13} value={sectors} onChange={(e) => setSectors(e.target.value)} />
          </label>
          <label>
            <input
              type="checkbox"
              checked={link}
              disabled={!run}
              onChange={(e) => setLink(e.target.checked)}
            />
            Check against selected performance (currency, dates and net aggregate)
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                setAttribution(
                  (
                    await write(
                      "POST",
                      "/attribution",
                      {
                        name: "Authored sector example",
                        source: "authored_sector_example",
                        sourceRef: "teaching-sector-table",
                        from,
                        to,
                        currency: link && run ? run.currency : "USD",
                        benchmarkLabel: "Authored sector benchmark",
                        performance: link && run ? { id: run.id, revision: 1 } : null,
                        sectors: JSON.parse(sectors),
                      },
                      attributionResultSchema,
                    )
                  ).data,
                );
              })
            }
          >
            Calculate attribution
          </button>
          <label>
            Saved attribution
            <select
              value={attribution?.id ?? ""}
              onChange={(e) =>
                setAttribution(attributions.find((a) => a.id === e.target.value) ?? null)
              }
            >
              <option value="">Select authored result</option>
              {attributions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.request.name} · {a.createdAt} · {a.linkage}
                </option>
              ))}
            </select>
          </label>
          {attribution && (
            <div data-testid="attribution-result">
              <h3>Active return: {pct(attribution.activeReturn)}</h3>
              <p>
                Portfolio {pct(attribution.portfolioReturn)} · benchmark{" "}
                {pct(attribution.benchmarkReturn)} · residual {pct(attribution.residual)} ·{" "}
                {attribution.reconciled ? "reconciled" : "unreconciled"}.
              </p>
              <p>
                Linkage: {attribution.linkage}. {attribution.linkageReasons.join(" ")}
              </p>
              <AttributionWaterfall value={attribution} />
              <div className="chapter-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Sector</th>
                      <th>Allocation</th>
                      <th>Selection</th>
                      <th>Interaction</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attribution.effects.map((e) => (
                      <tr key={e.sector}>
                        <td>{e.sector}</td>
                        <td>{pct(e.allocation)}</td>
                        <td>{pct(e.selection)}</td>
                        <td>{pct(e.interaction)}</td>
                        <td>{pct(e.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul>
                {attribution.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </LearningShell>
  );
}
function ReturnCurve({ run }: { run: PerformanceSnapshot }) {
  if (run.twr.value === null)
    return <p>No complete linked return curve: a required subperiod is unavailable.</p>;
  const values = [100];
  for (const p of run.periods) values.push(values.at(-1)! * (1 + p.netReturn!));
  const low = Math.min(...values) * 0.995,
    high = Math.max(...values) * 1.005,
    range = high - low || 1;
  const point = (v: number, i: number) => ({
    x: 40 + (i * 520) / (values.length - 1),
    y: 130 - ((v - low) / range) * 100,
  });
  return (
    <figure>
      <svg
        viewBox="0 0 600 170"
        role="img"
        aria-label="Flow-adjusted wealth index with external-flow markers"
      >
        <polyline
          points={values
            .map((v, i) => {
              const p = point(v, i);
              return p.x + "," + p.y;
            })
            .join(" ")}
          fill="none"
          className="chart-series"
          strokeWidth="3"
        />
        {values.map((v, i) => {
          const p = point(v, i);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="5"
              className={
                i > 0 && Number(run.periods[i - 1]!.externalFlow) !== 0
                  ? "chart-negative-fill"
                  : "chart-series-fill"
              }
            >
              <title>
                Index {v.toFixed(4)}; external flow{" "}
                {i ? run.periods[i - 1]!.externalFlow : "opening"}
              </title>
            </circle>
          );
        })}
        <text x="40" y="160" fontSize="13">
          Opening index 100
        </text>
        <text x="560" y="160" textAnchor="end" fontSize="13">
          Ending {values.at(-1)!.toFixed(4)}
        </text>
      </svg>
      <figcaption>
        Linked net return index, equally spaced valuation checkpoints. Highlighted markers identify
        external-flow intervals; deposits do not create index growth.
      </figcaption>
    </figure>
  );
}
function AttributionWaterfall({ value }: { value: AttributionResult }) {
  const labels = ["Allocation", "Selection", "Interaction", "Active"],
    changes = [value.allocation, value.selection, value.interaction, value.activeReturn],
    cumulative = [
      0,
      value.allocation,
      value.allocation + value.selection,
      value.allocation + value.selection + value.interaction,
    ],
    low = Math.min(0, ...cumulative, value.activeReturn),
    high = Math.max(0, ...cumulative, value.activeReturn),
    range = high - low || 1,
    y = (n: number) => 120 - ((n - low) / range) * 85;
  return (
    <figure>
      <svg viewBox="0 0 600 180" role="img" aria-label="Attribution effects waterfall">
        {changes.map((change, i) => {
          const a = i === 3 ? 0 : cumulative[i]!,
            b = i === 3 ? change : cumulative[i + 1]!;
          return (
            <g key={i}>
              <rect
                x={35 + i * 145}
                y={Math.min(y(a), y(b))}
                width="95"
                height={Math.max(1, Math.abs(y(a) - y(b)))}
                className={change < 0 ? "chart-negative-fill" : "chart-series-fill"}
              />
              <text x={82 + i * 145} y="145" textAnchor="middle" fontSize="13">
                {labels[i]}
              </text>
              <text x={82 + i * 145} y="165" textAnchor="middle">
                {pct(change)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        Three arithmetic effects accumulate to active return; the residual is reported separately.
      </figcaption>
    </figure>
  );
}
