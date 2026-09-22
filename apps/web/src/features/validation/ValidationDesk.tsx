import { useEffect, useState } from "react";
import { z } from "zod";
import {
  validationRunSchema,
  validationRequestSchema,
  marketDatasetSchema,
  type ValidationRun,
  type ValidationRequest,
  type MarketDataset,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "../valuation/valuation.css";
const pct = (n: number) => (n * 100).toFixed(2) + "%";
export function ValidationDesk() {
  const [runs, setRuns] = useState<ValidationRun[]>([]),
    [run, setRun] = useState<ValidationRun | null>(null),
    [datasets, setDatasets] = useState<MarketDataset[]>([]);
  const [scenario, setScenario] = useState<ValidationRequest["scenario"]>("clean"),
    [window, setWindow] = useState<ValidationRequest["window"]>("expanding"),
    [fee, setFee] = useState("10"),
    [dataset, setDataset] = useState(""),
    [selected, setSelected] = useState(2),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/validation-runs", z.array(validationRunSchema), abort.signal),
      read("/datasets", z.array(marketDatasetSchema), abort.signal),
    ])
      .then(([r, d]) => {
        setRuns(r.data);
        setDatasets(d.data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const source = datasets.find((d) => d.id === dataset);
      const value = (
        await write(
          "POST",
          "/validation-runs",
          validationRequestSchema.parse({
            scenario,
            window,
            feeBps: Number(fee),
            dataset: source ? { id: source.id, revision: source.revision } : null,
          }),
          validationRunSchema,
        )
      ).data;
      setRun(value);
      setSelected(value.folds.length > 2 ? 2 : 0);
      setRuns((r) => [...r.filter((i) => i.id !== value.id), value]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const fold = run?.folds[selected];
  const points = fold?.equity
    .map((e, i) =>
      [
        35 + i * 130,
        190 -
          ((Number(e.nav) - Math.min(...fold.equity.map((e) => Number(e.nav)))) /
            Math.max(
              1,
              Math.max(...fold.equity.map((e) => Number(e.nav))) -
                Math.min(...fold.equity.map((e) => Number(e.nav))),
            )) *
            140,
      ].join(","),
    )
    .join(" ");
  return (
    <LearningShell active={10}>
      <div className="chapter-page">
        <div className="chapter-kicker">CHAPTER 10 · CAUSAL VALIDATION</div>
        <h1>When did we know?</h1>
        <p className="chapter-intro">
          Fit on earlier observations. Fill at the next open. Follow every cost into the book before
          trusting the return.
        </p>
        {error && (
          <div role="alert" className="chapter-warning">
            {error}
          </div>
        )}
        <section className="chapter-panel">
          <h2>Freeze an experiment</h2>
          <p>
            Authored 16-session history, two USD instruments, 80% risky budget and three
            independently funded folds. The last fold is the holdout.
          </p>
          <div className="chapter-form">
            <label>
              Historical scenario
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as typeof scenario)}
              >
                <option value="clean">Complete authored history</option>
                <option value="late-filing">Late filing</option>
                <option value="missing-session">Missing session</option>
                <option value="delisted">Delisted member with recovery</option>
              </select>
            </label>
            <label>
              Training window
              <select value={window} onChange={(e) => setWindow(e.target.value as typeof window)}>
                <option value="expanding">Expanding history</option>
                <option value="rolling">Previous four sessions</option>
              </select>
            </label>
            <label>
              Fee sensitivity center (bps)
              <input
                type="number"
                min="0"
                max="500"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </label>
            <label>
              Historical suitability source
              <select value={dataset} onChange={(e) => setDataset(e.target.value)}>
                <option value="">Authored historical fixture</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.instrument.returnedSymbol} · current dataset r{d.revision}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>
            Current provider history cannot prove historical availability or universe completeness.
            Selecting it produces a saved blocked verdict.
          </p>
          <button className="primary" disabled={busy} onClick={() => void create()}>
            {busy ? "Replaying journals…" : "Run causal validation"}
          </button>
          <label>
            Saved validation run
            <select
              value={run?.id ?? ""}
              onChange={(e) => {
                setRun(runs.find((r) => r.id === e.target.value) ?? null);
                setSelected(0);
              }}
            >
              <option value="">Select a run</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.request.scenario} · {r.request.window} · {r.status} · {r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        </section>
        {run && (
          <section className="chapter-panel" data-testid="validation-result">
            <h2>Validation: {run.status}</h2>
            <p>
              Frozen settings: {run.request.scenario}; {run.request.window}; {run.request.feeBps}{" "}
              bps. Fixture {run.fixture.id}, revision {run.fixture.revision}.
            </p>
            {run.reasons.map((r) => (
              <p key={r} className="chapter-warning">
                {r}
              </p>
            ))}
            {run.folds.length > 0 && (
              <>
                <h3>Out-of-sample and cost comparison</h3>
                <p>
                  Each row starts with $10,000. Returns include entry fees and unrealized holdings;
                  they are not one linked account.
                </p>
                <div className="chapter-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fold</th>
                        <th>Policy</th>
                        <th>Fee bps</th>
                        <th>Return</th>
                        <th>Drawdown</th>
                        <th>Fees USD</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.folds.map((f, i) => (
                        <tr key={i}>
                          <td>{f.name}</td>
                          <td>{f.policy}</td>
                          <td>{f.feeBps}</td>
                          <td>{pct(f.returnFraction)}</td>
                          <td>{pct(f.maximumDrawdown)}</td>
                          <td>{f.fees}</td>
                          <td>
                            <button
                              className="secondary"
                              onClick={() => setSelected(i)}
                              aria-label={
                                "Inspect " + f.name + " " + f.policy + " " + f.feeBps + " bps"
                              }
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {fold && (
              <>
                <h3>
                  Selected fold: {fold.name} · {fold.policy} · {fold.feeBps} bps
                </h3>
                <p>
                  Training {fold.trainStart} → {fold.trainEnd}. Test {fold.testStart} →{" "}
                  {fold.testEnd}. Selected: {fold.selectedIds.join(", ") || "cash"}.
                </p>
                <p>
                  Fitted training scores:{" "}
                  {fold.fittedScores.map((s) => s.instrumentId + " " + pct(s.score)).join("; ")}.
                </p>
                <svg
                  className="benchmark-chart"
                  role="img"
                  aria-label="Selected fold NAV path; exact values in the following table"
                  viewBox="0 0 600 220"
                >
                  <path d="M35 30 V190 H570" fill="none" stroke="#bccac5" />
                  <polyline points={points} fill="none" stroke="#205750" strokeWidth="3" />
                  <text x="35" y="215" fontSize="12">
                    Initial capital → each test close (USD)
                  </text>
                </svg>
                <div className="chapter-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Valuation time</th>
                        <th>NAV USD</th>
                        <th>Drawdown</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fold.equity.map((e) => (
                        <tr key={e.at}>
                          <td>{e.at}</td>
                          <td>{e.nav}</td>
                          <td>{pct(e.drawdown)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3>Causal timeline</h3>
                <ol>
                  {fold.timeline.map((e, i) => (
                    <li key={i}>
                      <strong>{e.kind}</strong> · {e.at}
                      <p>{e.detail}</p>
                    </li>
                  ))}
                </ol>
                <details>
                  <summary>Reconciled journal and lots</summary>
                  <pre style={{ overflow: "auto", maxHeight: 400, fontSize: "0.8rem" }}>
                    {JSON.stringify(fold.book, null, 2)}
                  </pre>
                </details>
              </>
            )}
            <h3>Provenance and limits</h3>
            <ul>
              {run.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <details>
              <summary>Frozen bars, membership and filing clocks</summary>
              <pre style={{ overflow: "auto", maxHeight: 400, fontSize: "0.8rem" }}>
                {JSON.stringify(run.fixture, null, 2)}
              </pre>
            </details>
          </section>
        )}
      </div>
    </LearningShell>
  );
}
