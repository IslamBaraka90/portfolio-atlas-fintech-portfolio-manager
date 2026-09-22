import { useEffect, useState } from "react";
import { z } from "zod";
import {
  adjustmentResultSchema,
  marketDatasetSchema,
  riskModelSnapshotSchema,
  type AdjustmentResult,
  type MarketDataset,
  type RiskModelSnapshot,
  type RiskModelRequest,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "../valuation/valuation.css";
import "../research/research.css";
const key = (r: { id: string; revision: number }) => r.id + ":" + r.revision;
const pct = (v: number) => (100 * v).toFixed(2) + "%";
export function RiskDesk() {
  const [runs, setRuns] = useState<AdjustmentResult[]>([]),
    [datasets, setDatasets] = useState<MarketDataset[]>([]),
    [models, setModels] = useState<RiskModelSnapshot[]>([]);
  const [selected, setSelected] = useState<string[]>([]),
    [model, setModel] = useState<RiskModelSnapshot | null>(null),
    [comparison, setComparison] = useState<RiskModelSnapshot | null>(null);
  const [returnType, setReturnType] = useState<RiskModelRequest["returnType"]>("simple"),
    [basis, setBasis] = useState<RiskModelRequest["returnBasis"]>("gross_total_return"),
    [estimator, setEstimator] = useState<RiskModelRequest["estimator"]>("sample"),
    [annualization, setAnnualization] = useState("252"),
    [decay, setDecay] = useState("0.94"),
    [assumption, setAssumption] = useState<RiskModelRequest["expectedReturnAssumption"]>("zero"),
    [scenarios, setScenarios] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/adjustment-runs", z.array(adjustmentResultSchema), abort.signal),
      read("/datasets", z.array(marketDatasetSchema), abort.signal),
      read("/risk-models", z.array(riskModelSnapshotSchema), abort.signal),
    ])
      .then(([r, d, m]) => {
        setRuns(r.data);
        setDatasets(d.data);
        setModels(m.data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  const source = (run: AdjustmentResult) =>
    datasets.find((d) => d.id === run.datasetId && d.revision === run.datasetRevision);
  async function calculate(method = estimator, compare = false) {
    setBusy(true);
    setError("");
    try {
      const chosen = selected.map((v) => runs.find((r) => key(r) === v)!);
      const request: RiskModelRequest =
        compare && model
          ? { ...model.request, estimator: method, decay: Number(decay) }
          : {
              adjustmentRuns: chosen.map((r) => ({ id: r.id, revision: r.revision })),
              asOf: new Date().toISOString(),
              returnType,
              returnBasis: basis,
              estimator: method,
              annualization: Number(annualization),
              decay: Number(decay),
              expectedReturnAssumption: assumption,
              annualExpectedReturns:
                assumption === "scenario"
                  ? chosen.map((r) => ({
                      instrumentId: source(r)!.instrument.instrumentId,
                      annualReturn: Number(scenarios[key(r)] ?? "0"),
                    }))
                  : [],
            };
      const value = (await write("POST", "/risk-models", request, riskModelSnapshotSchema)).data;
      setModels((rows) => [...rows.filter((r) => r.id !== value.id), value]);
      if (compare) setComparison(value);
      else {
        setModel(value);
        setComparison(null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LearningShell active={8}>
      <div className="chapter-page research-page">
        <p className="eyebrow">CHAPTER 08 / RISK INPUTS</p>
        <h1>
          Risk starts with
          <br />
          comparable observations.
        </h1>
        <p className="chapter-intro">
          Inspect the sample behind the matrix. Asset order, missing sessions and estimation
          assumptions are part of every saved risk model.
        </p>
        {error && (
          <div role="alert" className="chapter-warning">
            {error}
          </div>
        )}
        <section className="chapter-panel">
          <h2>01 / Select an ordered universe</h2>
          <p>
            Prepare two to eight histories in <a href="#actions">Actions & currency</a>. Only exact
            dataset revisions listed below are selectable. Selection order becomes matrix order.
          </p>
          <fieldset disabled={busy} className="valuation-fields">
            {runs
              .filter((r) => source(r))
              .map((r) => (
                <div className="research-input" key={key(r)}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(key(r))}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked ? [...s, key(r)] : s.filter((v) => v !== key(r)),
                        )
                      }
                    />
                    {source(r)!.instrument.returnedSymbol} · {source(r)!.request.scenario} ·
                    adjustment r{r.revision} · {r.status}
                  </label>
                  {assumption === "scenario" && selected.includes(key(r)) && (
                    <label>
                      Annual return assumption for {source(r)!.instrument.returnedSymbol}
                      <input
                        type="number"
                        min="-1"
                        max="5"
                        step="0.01"
                        value={scenarios[key(r)] ?? "0"}
                        onChange={(e) => setScenarios((s) => ({ ...s, [key(r)]: e.target.value }))}
                      />
                    </label>
                  )}
                </div>
              ))}
            {!runs.length && <p>No reviewed histories yet.</p>}
            <p>
              Ordered selections:{" "}
              {selected
                .map((v) => {
                  const r = runs.find((r) => key(r) === v)!;
                  return source(r)?.instrument.returnedSymbol ?? v;
                })
                .join(" → ") || "None"}
            </p>
            <div className="chapter-form">
              <label>
                Return convention
                <select
                  value={returnType}
                  onChange={(e) => setReturnType(e.target.value as typeof returnType)}
                >
                  <option value="simple">Simple fractional returns</option>
                  <option value="log">Log returns</option>
                </select>
              </label>
              <label>
                Income basis
                <select value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)}>
                  <option value="gross_total_return">Gross total return</option>
                  <option value="price">Price only</option>
                </select>
              </label>
              <label>
                Covariance estimator
                <select
                  value={estimator}
                  onChange={(e) => setEstimator(e.target.value as typeof estimator)}
                >
                  <option value="sample">Sample · n−1</option>
                  <option value="ewma">EWMA · zero-mean assumption</option>
                  <option value="ledoit_wolf">Ledoit–Wolf · scaled identity</option>
                </select>
              </label>
              <label>
                Sessions per year
                <input
                  type="number"
                  min="1"
                  max="366"
                  value={annualization}
                  onChange={(e) => setAnnualization(e.target.value)}
                />
              </label>
              <label>
                EWMA decay
                <input
                  type="number"
                  min="0.01"
                  max="0.99"
                  step="0.01"
                  value={decay}
                  onChange={(e) => setDecay(e.target.value)}
                />
              </label>
              <label>
                Expected-return assumption
                <select
                  value={assumption}
                  onChange={(e) => setAssumption(e.target.value as typeof assumption)}
                >
                  <option value="zero">Zero expected return</option>
                  <option value="historical_mean">Historical mean estimate</option>
                  <option value="scenario">Named annual scenarios</option>
                </select>
              </label>
            </div>
            <button
              className="primary"
              disabled={selected.length < 2 || selected.length > 8}
              onClick={() => void calculate()}
            >
              Freeze risk model
            </button>
          </fieldset>
        </section>
        <section className="chapter-panel">
          <h2>02 / Inspect a frozen estimate</h2>
          <label>
            Saved risk model
            <select
              value={model?.id ?? ""}
              onChange={(e) => {
                setModel(models.find((m) => m.id === e.target.value) ?? null);
                setComparison(null);
              }}
            >
              <option value="">Select a snapshot</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.createdAt} · {m.request.estimator} · {m.status} · {m.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          {model && (
            <div data-testid="risk-result">
              <h3>Risk model: {model.status}</h3>
              <p>
                {model.currency ?? "Unknown currency"} · {model.request.returnType} ·{" "}
                {model.request.returnBasis} · {model.request.estimator} ·{" "}
                {model.request.annualization} sessions/year
              </p>
              <p>
                Sample: {model.observations} daily intervals, {model.assets.length} assets. Missing
                policy: reject incomplete aligned sample.
              </p>
              {model.reasons.map((r) => (
                <p className="chapter-warning" key={r}>
                  {r}
                </p>
              ))}
              <div className="chapter-table-wrap">
                <table>
                  <caption>Ordered sample and assumptions</caption>
                  <thead>
                    <tr>
                      <th>Column</th>
                      <th>Instrument</th>
                      <th>Daily mean</th>
                      <th>Annual assumption</th>
                      <th>Annual volatility</th>
                      <th>Input revision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.assets.map((a, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{a.symbol}</td>
                        <td>
                          {model.dailyMeans[i] === undefined
                            ? "Unavailable"
                            : pct(model.dailyMeans[i]!)}
                        </td>
                        <td>
                          {model.annualExpectedReturns[i] === undefined
                            ? "Unavailable"
                            : pct(model.annualExpectedReturns[i]!)}
                        </td>
                        <td>
                          {model.volatilityAnnual[i] === undefined
                            ? "Unavailable"
                            : pct(model.volatilityAnnual[i]!)}
                        </td>
                        <td>
                          Data r{a.dataset.revision} / adjustment r{a.adjustmentRun.revision}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {model.status === "ready" && (
                <>
                  <Matrix
                    title="Annual covariance · squared fractional returns"
                    values={model.covarianceAnnual}
                    labels={model.assets.map((a) => a.symbol)}
                  />
                  <Matrix
                    title="Correlation · undefined for zero variance"
                    values={model.correlation}
                    labels={model.assets.map((a) => a.symbol)}
                  />
                  <p>
                    Rank: {model.diagnostics?.rank} / {model.assets.length} · Positive definite:{" "}
                    {model.diagnostics?.positiveDefinite ? "yes" : "no"} · Condition number:{" "}
                    {model.diagnostics?.conditionNumber?.toFixed(2) ?? "Undefined"}
                  </p>
                  <p>
                    Centering: {model.estimatorDetails.centering} · Denominator:{" "}
                    {model.estimatorDetails.denominator ?? "Not used"} · Shrinkage:{" "}
                    {model.estimatorDetails.shrinkage ?? "Not used"}
                  </p>
                  <p>
                    EWMA observation weight: {model.estimatorDetails.weightMass ?? "Not used"} ·
                    Seed weight: {model.estimatorDetails.seedWeight ?? "Not used"}
                  </p>
                  <details>
                    <summary>Exact aligned return intervals</summary>
                    <div className="chapter-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>From → to</th>
                            {model.assets.map((a) => (
                              <th key={a.instrumentId}>{a.symbol}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {model.intervals.map((r, i) => (
                            <tr key={r.to}>
                              <td>
                                {r.from} → {r.to}
                              </td>
                              {model.returns[i]!.map((v, j) => (
                                <td key={j}>{v.toPrecision(8)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              )}
              <details>
                <summary>Provenance and limitations</summary>
                <p>
                  {model.id} · revision {model.revision} · {model.createdAt} · cutoff{" "}
                  {model.request.asOf} · {model.policyVersion} · fintech-algorithms{" "}
                  {model.packageVersion} · shared-fixture parity
                </p>
                {model.assets.map((a, i) => (
                  <p key={i}>
                    {a.symbol}: dataset {a.dataset.id} / r{a.dataset.revision}; adjustment{" "}
                    {a.adjustmentRun.id} / r{a.adjustmentRun.revision}
                    <br />
                    <code>{a.sourceHash}</code>
                  </p>
                ))}
                {model.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </details>
              <h3>Method sensitivity on the same frozen sample</h3>
              <p>
                Comparison retains this model's exact inputs, units and cutoff. EWMA uses the decay
                field above.
              </p>
              <div className="chapter-form">
                {(["sample", "ewma", "ledoit_wolf"] as const).map((method) => (
                  <button
                    key={method}
                    disabled={busy}
                    className="secondary"
                    onClick={() => void calculate(method, true)}
                  >
                    Compare {method}
                  </button>
                ))}
              </div>
              {comparison && (
                <div data-testid="risk-comparison">
                  <p>
                    Comparison: {comparison.request.estimator} · {comparison.status} · rank{" "}
                    {comparison.diagnostics?.rank ?? "Unavailable"}
                  </p>
                  <div className="chapter-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Selected model volatility</th>
                          <th>Comparison volatility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.assets.map((a, i) => (
                          <tr key={i}>
                            <td>{a.symbol}</td>
                            <td>
                              {model.volatilityAnnual[i] === undefined
                                ? "Unavailable"
                                : pct(model.volatilityAnnual[i]!)}
                            </td>
                            <td>
                              {comparison.volatilityAnnual[i] === undefined
                                ? "Unavailable"
                                : pct(comparison.volatilityAnnual[i]!)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {comparison.reasons.map((r) => (
                    <p key={r}>{r}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </LearningShell>
  );
}
function Matrix({
  title,
  values,
  labels,
}: {
  title: string;
  values: (number | null)[][];
  labels: string[];
}) {
  return (
    <div className="chapter-table-wrap">
      <table>
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Asset</th>
            {labels.map((l, i) => (
              <th key={i}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((row, i) => (
            <tr key={i}>
              <th>{labels[i]}</th>
              {row.map((v, j) => (
                <td
                  key={j}
                  style={{ background: v === null ? "#fff0df" : v < 0 ? "#f4eee2" : "#edf2e8" }}
                >
                  {v === null ? "Undefined" : v.toPrecision(6)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
