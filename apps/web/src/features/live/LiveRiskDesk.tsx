import { useEffect, useState } from "react";
import { z } from "zod";
import {
  liveRiskSchema,
  portfolioSchema,
  refreshCycleSchema,
  type LiveRisk,
  type Portfolio,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import { recordCycle, useLive } from "../../shared/live";
import { clockTime } from "./LiveRuntimeDesk";
import "./live.css";

const pct = (v: number | null, digits = 2) =>
  v === null ? "Unavailable" : (v * 100).toFixed(digits) + "%";
const num = (v: number | null) => (v === null ? "Unavailable" : v.toFixed(3));

export function LiveRiskDesk() {
  const { riskUpdates, status } = useLive();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioId, setPortfolioId] = useState("");
  const [risk, setRisk] = useState<LiveRisk | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void read("/portfolios", z.array(portfolioSchema))
      .then((r) => {
        setPortfolios(r.data);
        if (r.data.length) setPortfolioId((id) => id || r.data.at(-1)!.id);
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (!portfolioId) return;
    const abort = new AbortController();
    void read("/portfolios/" + portfolioId + "/live-risk", liveRiskSchema.nullable(), abort.signal)
      .then((r) => setRisk(r.data))
      .catch(() => undefined);
    return () => abort.abort();
  }, [portfolioId, riskUpdates[portfolioId]]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      recordCycle((await write("POST", "/live/cycles", {}, refreshCycleSchema)).data);
      const r = await read("/portfolios/" + portfolioId + "/live-risk", liveRiskSchema.nullable());
      setRisk(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LearningShell active={23}>
      <div className="chapter-page live-page">
        <p className="eyebrow">Chapter 23 · Live risk</p>
        <h1>Has the live portfolio drifted into a risk we said we would not take?</h1>
        <p className="chapter-intro">
          Each new live valuation is assessed once: volatility, beta and tracking error from final
          daily bars, drawdown from the live NAV series, and the Chapter 14 monitor against the
          mandate. Forming bars never enter these numbers.
        </p>
        {error && (
          <div className="chapter-warning" role="alert">
            {error}
          </div>
        )}
        {portfolios.length === 0 ? (
          <p className="chapter-notice">Create and fund a portfolio first.</p>
        ) : (
          <section className="chapter-panel" aria-labelledby="risk-title">
            <div className="live-panel-head">
              <h2 id="risk-title">Portfolio risk</h2>
              <button
                type="button"
                className="primary"
                disabled={busy || status?.cycleInProgress}
                onClick={() => void refresh()}
              >
                Refresh risk
              </button>
            </div>
            <div className="chapter-form">
              <label>
                Portfolio
                <select value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {!risk ? (
              <p className="chapter-muted">
                No assessment yet. It runs after the first live valuation of this portfolio.
              </p>
            ) : (
              <>
                <div className="chapter-metrics">
                  <div>
                    <strong>{pct(risk.portfolio.volatility)}</strong>
                    <span>Annualized EWMA volatility (λ {risk.window.decay})</span>
                  </div>
                  <div>
                    <strong>{num(risk.portfolio.beta)}</strong>
                    <span>Beta to {risk.benchmark}</span>
                  </div>
                  <div>
                    <strong>{pct(risk.portfolio.trackingError)}</strong>
                    <span>Tracking error, annualized</span>
                  </div>
                  <div>
                    <strong>{pct(risk.portfolio.currentDrawdown)}</strong>
                    <span>
                      Current drawdown · worst {pct(risk.portfolio.maxDrawdown)} over{" "}
                      {risk.portfolio.navPoints} NAV points
                    </span>
                  </div>
                </div>
                <div
                  className={"live-banner " + (risk.monitor.breaches ? "is-breach" : "is-live")}
                  role="status"
                >
                  <strong>
                    {risk.monitor.breaches
                      ? risk.monitor.breaches + " limit breach observation(s)"
                      : "No limit breaches"}
                  </strong>
                  <span>
                    Monitor {risk.monitor.id?.slice(0, 8) ?? "not run"} · {risk.monitor.passes} pass
                    · {risk.monitor.unavailable} unavailable
                    {risk.monitor.reason ? " · " + risk.monitor.reason : ""}. Acknowledge or resolve
                    findings in <a href="#monitoring">Monitoring & alerts</a>.
                  </span>
                </div>
                <div className="chapter-table-wrap">
                  <table>
                    <caption>
                      {risk.window.returns} aligned final daily returns, {risk.window.from} to{" "}
                      {risk.window.to}
                      {risk.window.droppedSessions
                        ? "; " + risk.window.droppedSessions + " session(s) dropped by alignment"
                        : ""}
                      .
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Holding</th>
                        <th scope="col" className="num">
                          Weight
                        </th>
                        <th scope="col" className="num">
                          EWMA volatility
                        </th>
                        <th scope="col" className="num">
                          Beta
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {risk.holdings.map((h) => (
                        <tr key={h.instrumentId}>
                          <th scope="row">
                            {h.symbol ?? h.instrumentId}
                            <small>{h.instrumentId}</small>
                          </th>
                          <td className="num">{pct(h.weight)}</td>
                          <td className="num">{pct(h.ewmaVolatility)}</td>
                          <td className="num">{num(h.beta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="chapter-muted">
                  {risk.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                  <li>
                    Tiers: {Object.values(risk.tiers).join("; ")}. Assessed {clockTime(risk.asOf)}{" "}
                    under <code>{risk.policy}</code>.
                  </li>
                </ul>
              </>
            )}
          </section>
        )}
      </div>
    </LearningShell>
  );
}
