import { useEffect, useState } from "react";
import { z } from "zod";
import {
  portfolioSchema,
  mandateSchema,
  valuationSnapshotSchema,
  riskModelSnapshotSchema,
  targetSnapshotSchema,
  constructionRequestSchema,
  type Portfolio,
  type Mandate,
  type ValuationSnapshot,
  type RiskModelSnapshot,
  type TargetSnapshot,
  type ConstructionMethod,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "../valuation/valuation.css";
import "../research/research.css";
const methods: ConstructionMethod[] = [
  "equal_weight",
  "minimum_variance",
  "inverse_volatility",
  "turnover_constrained",
];
const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "Unavailable" : (100 * value).toFixed(2) + "%";
export function ConstructionDesk() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]),
    [mandates, setMandates] = useState<Mandate[]>([]),
    [valuations, setValuations] = useState<ValuationSnapshot[]>([]),
    [models, setModels] = useState<RiskModelSnapshot[]>([]),
    [targets, setTargets] = useState<TargetSnapshot[]>([]);
  const [portfolioId, setPortfolioId] = useState(""),
    [valuationId, setValuationId] = useState(""),
    [modelId, setModelId] = useState(""),
    [method, setMethod] = useState<ConstructionMethod>("equal_weight"),
    [cash, setCash] = useState("0.2"),
    [turnover, setTurnover] = useState("1"),
    [lambda, setLambda] = useState("1"),
    [cost, setCost] = useState("0"),
    [costCap, setCostCap] = useState("0.01"),
    [iterations, setIterations] = useState("5000"),
    [stress, setStress] = useState("1.5");
  const [target, setTarget] = useState<TargetSnapshot | null>(null),
    [compared, setCompared] = useState<TargetSnapshot[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/portfolios", z.array(portfolioSchema), abort.signal),
      read("/mandates", z.array(mandateSchema), abort.signal),
      read("/valuations", z.array(valuationSnapshotSchema), abort.signal),
      read("/risk-models", z.array(riskModelSnapshotSchema), abort.signal),
      read("/targets", z.array(targetSnapshotSchema), abort.signal),
    ])
      .then(([p, m, v, r, t]) => {
        setPortfolios(p.data);
        setMandates(m.data);
        setValuations(v.data);
        setModels(r.data);
        setTargets(t.data);
        setPortfolioId(p.data[0]?.id ?? "");
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  const portfolio = portfolios.find((p) => p.id === portfolioId),
    mandate = mandates.find((m) => m.id === portfolio?.mandateId);
  async function create(compare = false, stressed = false) {
    setBusy(true);
    setError("");
    try {
      const input =
        stressed && target
          ? { ...target.request, volatilityStress: Number(stress) }
          : constructionRequestSchema.parse({
              portfolioId,
              mandateRevision: mandate?.revision,
              riskModel: { id: modelId, revision: 1 },
              valuation: { id: valuationId, revision: 1 },
              method,
              cashWeight: Number(cash),
              lambdaRisk: Number(lambda),
              turnoverCap: Number(turnover),
              estimatedCostBps: Number(cost),
              maxCostFraction: Number(costCap),
              maxIterations: Number(iterations),
              volatilityStress: 1,
            });
      const results: TargetSnapshot[] = [];
      for (const choice of compare ? methods : [input.method]) {
        const value = (
          await write("POST", "/targets", { ...input, method: choice }, targetSnapshotSchema)
        ).data;
        results.push(value);
        setTargets((rows) => [...rows.filter((r) => r.id !== value.id), value]);
      }
      setTarget(results[0]!);
      setCompared(stressed && target ? [target, ...results] : results);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LearningShell active={9}>
      <div className="chapter-page research-page">
        <p className="eyebrow">CHAPTER 09 / PORTFOLIO CONSTRUCTION</p>
        <h1>
          A target needs
          <br />a reason and a boundary.
        </h1>
        <p className="chapter-intro">
          Compare released D14 methods against the mandate. A solver's successful result becomes a
          proposal only after its weights pass the portfolio rules.
        </p>
        {error && (
          <div role="alert" className="chapter-warning">
            {error}
          </div>
        )}
        <section className="chapter-panel">
          <h2>01 / Connect policy, risk and the book</h2>
          <p>
            Use a funded book and a saved <a href="#valuation">valuation</a>, then select the exact{" "}
            <a href="#risk">risk model</a>. No target changes cash, holdings or orders.
          </p>
          <fieldset disabled={busy} className="valuation-fields">
            <div className="chapter-form">
              <label>
                Construction portfolio
                <select
                  value={portfolioId}
                  onChange={(e) => {
                    setPortfolioId(e.target.value);
                    setValuationId("");
                    setTarget(null);
                    setCompared([]);
                  }}
                >
                  <option value="">Select portfolio</option>
                  {portfolios.map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Current valuation snapshot
                <select value={valuationId} onChange={(e) => setValuationId(e.target.value)}>
                  <option value="">Select valuation</option>
                  {valuations
                    .filter((v) => v.request.portfolioId === portfolioId)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        Checkpoint {v.request.checkpoint} · NAV {v.totals.nav ?? "Incomplete"} ·{" "}
                        {v.createdAt} · {v.id.slice(0, 8)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Construction risk model
                <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
                  <option value="">Select model</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.assets.map((a) => a.symbol).join("/")} · {m.request.estimator} ·{" "}
                      {m.request.returnType} · {m.status} · {m.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {mandate && (
              <p>
                Mandate r{mandate.revision}: cash {pct(mandate.minCashWeight)}–
                {pct(mandate.maxCashWeight)}, position cap {pct(mandate.maxPositionWeight)}, sector
                cap {pct(mandate.maxSectorWeight)}. {mandate.baseCurrency}.
              </p>
            )}
            <div className="chapter-form">
              <label>
                Construction method
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as ConstructionMethod)}
                >
                  {methods.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Fixed cash fraction
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                />
              </label>
              <label>
                Half-L1 turnover cap
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={turnover}
                  onChange={(e) => setTurnover(e.target.value)}
                />
              </label>
              <label>
                Risk penalty lambda
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={lambda}
                  onChange={(e) => setLambda(e.target.value)}
                />
              </label>
              <label>
                Estimated cost (bps)
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </label>
              <label>
                Maximum cost / NAV
                <input
                  type="number"
                  min="0"
                  max="0.2"
                  step="0.001"
                  value={costCap}
                  onChange={(e) => setCostCap(e.target.value)}
                />
              </label>
              <label>
                Solver iteration budget
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={iterations}
                  onChange={(e) => setIterations(e.target.value)}
                />
              </label>
            </div>
            <p className="chapter-muted">
              Fixed cash applies to equal weight, minimum variance and inverse volatility. Turnover
              optimization chooses its cash weight. Costs are estimated after calculation; they are
              not secretly included in the objective.
            </p>
            <div className="chapter-form">
              <button
                className="primary"
                disabled={!portfolioId || !valuationId || !modelId}
                onClick={() => void create()}
              >
                Create target proposal
              </button>
              <button
                className="secondary"
                disabled={!portfolioId || !valuationId || !modelId}
                onClick={() => void create(true)}
              >
                Compare construction methods
              </button>
            </div>
          </fieldset>
        </section>
        {compared.length > 1 && (
          <section className="chapter-panel">
            <h2>02 / Compare the outcomes</h2>
            <div className="chapter-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Method / stress</th>
                    <th>State</th>
                    <th>Cash</th>
                    <th>Volatility</th>
                    <th>Expected return</th>
                    <th>Turnover</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {compared.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.request.method} / {t.request.volatilityStress}×
                      </td>
                      <td>{t.status}</td>
                      <td>{pct(t.cashWeight)}</td>
                      <td>{pct(t.volatility)}</td>
                      <td>{pct(t.expectedReturn)}</td>
                      <td>{pct(t.turnover)}</td>
                      <td>
                        <button className="secondary" onClick={() => setTarget(t)}>
                          Inspect {t.request.method}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <section className="chapter-panel">
          <h2>03 / Inspect the target decision</h2>
          <label>
            Saved target snapshot
            <select
              value={target?.id ?? ""}
              onChange={(e) => setTarget(targets.find((t) => t.id === e.target.value) ?? null)}
            >
              <option value="">Select a frozen target</option>
              {targets
                .filter((t) => t.request.portfolioId === portfolioId)
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.request.method} · {t.status} · {t.createdAt} · {t.id.slice(0, 8)}
                  </option>
                ))}
            </select>
          </label>
          {target && (
            <div data-testid="target-result">
              <h3>Target: {target.status}</h3>
              <p>
                {target.request.method} · covariance volatility stress{" "}
                {target.request.volatilityStress}× · {target.currency} · pre-cost weights
              </p>
              <p>
                Frozen settings: fixed cash {pct(target.request.cashWeight)}, turnover cap{" "}
                {pct(target.request.turnoverCap)}, cost {target.request.estimatedCostBps} bps, cost
                budget {pct(target.request.maxCostFraction)}, risk penalty{" "}
                {target.request.lambdaRisk}, iteration budget {target.request.maxIterations}.
              </p>
              {target.reasons.map((r) => (
                <p key={r} className="chapter-warning">
                  {r}
                </p>
              ))}
              <div className="chapter-table-wrap">
                <table>
                  <caption>Allocation and risk contributions</caption>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Current</th>
                      <th>Proposed</th>
                      <th>Variance contribution</th>
                      <th>Risk share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...target.assetIds, "Cash"].map((id, i) => (
                      <tr key={id}>
                        <td>{id}</td>
                        <td>{pct(target.currentWeights[i])}</td>
                        <td>
                          {pct(
                            i === target.assetIds.length ? target.cashWeight : target.weights?.[i],
                          )}
                        </td>
                        <td>
                          {target.varianceContributions?.[i]?.toPrecision(7) ?? "Unavailable"}
                        </td>
                        <td>{pct(target.riskShares?.[i])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chapter-metrics">
                <div>
                  <span>Annual volatility</span>
                  <strong>{pct(target.volatility)}</strong>
                </div>
                <div>
                  <span>Annual return assumption</span>
                  <strong>{pct(target.expectedReturn)}</strong>
                </div>
                <div>
                  <span>Half-L1 turnover</span>
                  <strong>{pct(target.turnover)}</strong>
                </div>
                <div>
                  <span>Estimated cost / NAV</span>
                  <strong>{pct(target.estimatedCostFraction)}</strong>
                </div>
              </div>
              <p>
                Risky trade notional: {pct(target.riskyTradeNotional)}. Turnover includes cash;
                trading costs use risky trades only.
              </p>
              <div className="chapter-table-wrap">
                <table>
                  <caption>Constraint headroom · negative slack is a breach</caption>
                  <thead>
                    <tr>
                      <th>Rule</th>
                      <th>Subject</th>
                      <th>Status</th>
                      <th>Observed</th>
                      <th>Limit</th>
                      <th>Slack</th>
                      <th>Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {target.constraints.map((c, i) => (
                      <tr key={i}>
                        <td>{c.rule}</td>
                        <td>{c.subject}</td>
                        <td>{c.status}</td>
                        <td>{pct(c.observed)}</td>
                        <td>{pct(c.limit)}</td>
                        <td>{pct(c.slack)}</td>
                        <td>{c.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {target.solver && (
                <details open>
                  <summary>Solver termination and certificate</summary>
                  <p>
                    {target.solver.method} · status {target.solver.status} · iterations{" "}
                    {target.solver.iterations} · solution{" "}
                    {target.solver.solutionClass ?? "See certificate"}
                  </p>
                  <p>
                    Objective: {target.solver.objective ?? "Rule baseline"} · gap{" "}
                    {target.solver.gap ?? "Not applicable"} · budget residual{" "}
                    {target.solver.budgetResidual ?? "Unavailable"}
                  </p>
                  <details>
                    <summary>Full solver diagnostics</summary>
                    <pre style={{ overflow: "auto", maxHeight: 320 }}>
                      {JSON.stringify(target.solver.details, null, 2)}
                    </pre>
                  </details>
                  {target.solver.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </details>
              )}
              <details>
                <summary>Frozen evidence and limitations</summary>
                <p>
                  Target {target.id} / r{target.revision} · {target.createdAt}
                </p>
                <p>
                  Risk model {target.request.riskModel.id} / r{target.request.riskModel.revision};
                  valuation {target.request.valuation.id} / r{target.request.valuation.revision};
                  book checkpoint {target.bookCheckpoint}; mandate {target.mandate.id} / r
                  {target.mandate.revision}.
                </p>
                <p>
                  {target.policyVersion} · fintech-algorithms {target.packageVersion} · D14 contract
                  tier with independent application examples.
                </p>
                {target.warnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </details>
              <div className="chapter-form">
                <label>
                  Volatility stress factor
                  <input
                    type="number"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={stress}
                    onChange={(e) => setStress(e.target.value)}
                  />
                </label>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => void create(false, true)}
                >
                  Compare stressed inputs
                </button>
              </div>
              <p>
                Stress retains this target's exact model, valuation and mandate revision. Covariance
                is multiplied by the square of the factor.
              </p>
              <button className="secondary" disabled>
                Send orders
              </button>
              <p>Proposals create no orders. Rebalancing and financing are separate steps.</p>
            </div>
          )}
        </section>
      </div>
    </LearningShell>
  );
}
