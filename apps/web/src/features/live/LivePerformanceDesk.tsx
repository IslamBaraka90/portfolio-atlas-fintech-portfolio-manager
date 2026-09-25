import { useEffect, useState } from "react";
import { z } from "zod";
import {
  livePerformanceSchema,
  portfolioSchema,
  refreshCycleSchema,
  type LivePerformance,
  type Portfolio,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import { recordCycle, useLive } from "../../shared/live";
import { clockTime } from "./LiveRuntimeDesk";
import "./live.css";

const pct = (v: number | null) => (v === null ? "Unavailable" : (v * 100).toFixed(2) + "%");

export function LivePerformanceDesk() {
  const { cycles, status } = useLive();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioId, setPortfolioId] = useState("");
  const [performance, setPerformance] = useState<LivePerformance | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastCycle = cycles[0]?.id;

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
    void read("/portfolios/" + portfolioId + "/live-performance", livePerformanceSchema.nullable())
      .then((r) => setPerformance(r.data))
      .catch(() => undefined);
  }, [portfolioId, lastCycle]);

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      recordCycle((await write("POST", "/live/cycles", {}, refreshCycleSchema)).data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LearningShell active={25}>
      <div className="chapter-page live-page">
        <p className="eyebrow">Chapter 25 · Live performance</p>
        <h1>How did the live portfolio do, and can someone else replay it?</h1>
        <p className="chapter-intro">
          The last NAV point of each session feeds the Chapter 15 time-weighted return, so deposits
          never count as return. After each close one Chapter 16 end-of-day report is frozen, and a
          recorded demo cache lets anyone replay the session offline.
        </p>
        {error && (
          <div className="chapter-warning" role="alert">
            {error}
          </div>
        )}
        {portfolios.length === 0 ? (
          <p className="chapter-notice">Create and fund a portfolio first.</p>
        ) : (
          <section className="chapter-panel" aria-labelledby="performance-title">
            <div className="live-panel-head">
              <h2 id="performance-title">Performance against the benchmark</h2>
              <button
                type="button"
                className="primary"
                disabled={busy || status?.cycleInProgress}
                onClick={() => void refresh()}
              >
                Refresh performance
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
            {!performance ? (
              <p className="chapter-muted">
                No measurement yet. It runs after the first live valuation.
              </p>
            ) : (
              <>
                <div className="chapter-metrics">
                  <div>
                    <strong>{pct(performance.twr)}</strong>
                    <span>Time-weighted return, net of recorded fees</span>
                  </div>
                  <div>
                    <strong>{pct(performance.benchmarkReturn)}</strong>
                    <span>{performance.benchmark} price return</span>
                  </div>
                  <div>
                    <strong>{pct(performance.activeReturn)}</strong>
                    <span>Active return</span>
                  </div>
                  <div>
                    <strong>{performance.investmentProfit ?? "Unavailable"}</strong>
                    <span>Investment profit (excludes deposits)</span>
                  </div>
                </div>
                <dl className="chapter-provenance">
                  <div>
                    <dt>Sessions linked</dt>
                    <dd>
                      {performance.sessions.length
                        ? performance.sessions[0] +
                          " → " +
                          performance.sessions.at(-1) +
                          " (" +
                          performance.sessions.length +
                          ")"
                        : "None"}
                    </dd>
                  </div>
                  <div>
                    <dt>End-of-day report</dt>
                    <dd>
                      {performance.reportId ? (
                        <a href="#reports">
                          {performance.reportSession} · {performance.reportId.slice(0, 8)}
                        </a>
                      ) : (
                        "Frozen after the next completed session"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Measured</dt>
                    <dd>{clockTime(performance.asOf)}</dd>
                  </div>
                  <div>
                    <dt>Policy</dt>
                    <dd>
                      <code>{performance.policy}</code>
                    </dd>
                  </div>
                </dl>
                <ul className="chapter-muted">
                  {performance.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
        <section className="chapter-panel" aria-labelledby="cache-title">
          <h2 id="cache-title">Record and replay</h2>
          <p>
            Set <code>LIVE_CACHE_RECORD=.data/demo-cache/session.json</code> while the live desk
            runs to keep every provider reply with a SHA-256 manifest. Later, start with{" "}
            <code>DEMO_CACHE_PATH</code> pointing at that file: the desk replays the session on a
            clock that starts at the recording, and a cache with one changed byte is refused.
            Recorded data stays on your machine; it is not redistributed.
          </p>
        </section>
      </div>
    </LearningShell>
  );
}
