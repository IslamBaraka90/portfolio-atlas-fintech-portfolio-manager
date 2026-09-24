import { useState } from "react";
import { refreshCycleSchema, type RefreshCycle } from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { write } from "../../shared/api";
import { recordCycle, useLive } from "../../shared/live";
import "./live.css";

export const duration = (ms: number) =>
  ms >= 86_400_000
    ? ms / 86_400_000 + (ms === 86_400_000 ? " day" : " days")
    : ms >= 3_600_000
      ? ms / 3_600_000 + " h"
      : ms >= 60_000
        ? ms / 60_000 + " min"
        : ms / 1000 + " s";
export const clockTime = (iso: string | null) =>
  iso ? iso.replace("T", " ").replace(/\.\d+Z$/, "Z") : "—";
const statusTone: Record<string, string> = {
  completed: "good",
  healthy: "good",
  partial: "warning",
  degraded: "warning",
  failed: "danger",
  backing_off: "danger",
  idle: "",
};
const cadenceLabel = {
  eod: "End of day",
  "15m": "15 minutes",
  "5m": "5 minutes",
  "1m": "1 minute",
};

export function LiveRuntimeDesk() {
  const { status, cycles, connection } = useLive();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const policy = status?.policy;
  return (
    <LearningShell active={18}>
      <div className="chapter-page live-page">
        <p className="eyebrow">Chapter 18 · Live runtime</p>
        <h1>Know how fresh every number is.</h1>
        <p className="chapter-intro">
          Choose demo or live data and a refresh cadence in <code>.env</code>. Every refresh cycle,
          skipped tick, provider failure and back-off becomes evidence you can inspect.
        </p>
        {!status || !policy ? (
          <p className="chapter-notice" role="status">
            Connecting to the live runtime…
          </p>
        ) : (
          <>
            <div
              className={"live-banner " + (policy.mode === "live" ? "is-live" : "is-demo")}
              role="status"
            >
              <strong>{policy.mode === "live" ? "Live Yahoo data" : "Demo data"}</strong>
              <span>
                {policy.mode === "live"
                  ? "Polling Yahoo Finance through the local API. Local use only; no redistribution."
                  : "Synthetic fixtures. Set MARKET_DATA_MODE=live to poll Yahoo Finance."}
              </span>
              <span className="badge">
                Event stream: {connection === "open" ? "connected" : connection}
              </span>
            </div>
            {error && (
              <div className="chapter-warning" role="alert">
                {error}
              </div>
            )}
            <section className="chapter-panel" aria-labelledby="policy-title">
              <h2 id="policy-title">Runtime policy</h2>
              <div className="chapter-metrics">
                <div>
                  <strong>{cadenceLabel[policy.cadence]}</strong>
                  <span>Refresh cadence (LIVE_REFRESH)</span>
                </div>
                <div>
                  <strong>{duration(policy.cacheTtlMs)}</strong>
                  <span>Provider cache lifetime, below the {duration(policy.periodMs)} period</span>
                </div>
                <div>
                  <strong>{duration(policy.freshnessSeconds * 1000)}</strong>
                  <span>Freshness limit before a price is stale</span>
                </div>
                <div>
                  <strong>{policy.requestsPerMinute}</strong>
                  <span>Provider requests per minute, queued and paced</span>
                </div>
              </div>
              <dl className="chapter-provenance">
                <div>
                  <dt>Watchlist</dt>
                  <dd>{policy.watchlist.join(", ") || "None"}</dd>
                </div>
                <div>
                  <dt>Benchmark</dt>
                  <dd>{policy.benchmark}</dd>
                </div>
                <div>
                  <dt>Back-off ceiling</dt>
                  <dd>{duration(policy.backoffCeilingMs)}</dd>
                </div>
                <div>
                  <dt>Policy version</dt>
                  <dd>
                    <code>{policy.version}</code>
                  </dd>
                </div>
              </dl>
            </section>
            <div className="live-grid">
              <section className="chapter-panel" aria-labelledby="session-title">
                <h2 id="session-title">Primary session</h2>
                <p className={"live-state " + status.session.state}>
                  <span aria-hidden="true" />
                  {status.session.state === "open"
                    ? "Regular hours"
                    : status.session.state === "closed"
                      ? "Market closed"
                      : "Unknown venue"}
                </p>
                <dl className="live-list">
                  <dt>Exchange timezone</dt>
                  <dd>{status.session.timezone}</dd>
                  <dt>Regular hours</dt>
                  <dd>{status.session.venueHours ?? "Not modeled"}</dd>
                  <dt>Local time</dt>
                  <dd>
                    {status.session.localDate} {status.session.localTime}
                  </dd>
                  <dt>Reason</dt>
                  <dd>{status.session.basis.replaceAll("_", " ")}</dd>
                  <dt>Latest completed session</dt>
                  <dd>{status.session.latestCompletedSession ?? "—"}</dd>
                </dl>
                <p className="chapter-muted">
                  Holidays and half days are not modeled. An open verdict is not proof that the
                  exchange traded.
                </p>
              </section>
              <section className="chapter-panel" aria-labelledby="health-title">
                <h2 id="health-title">Provider health</h2>
                <p className={"badge " + (statusTone[status.health.status] ?? "")}>
                  {status.health.status.replace("_", " ")}
                </p>
                <dl className="live-list">
                  <dt>Consecutive failures</dt>
                  <dd>{status.health.consecutiveFailures}</dd>
                  <dt>Last success</dt>
                  <dd>{clockTime(status.health.lastSuccessAt)}</dd>
                  <dt>Last failure</dt>
                  <dd>
                    {status.health.lastFailure
                      ? status.health.lastFailure.code +
                        " · " +
                        clockTime(status.health.lastFailureAt)
                      : "—"}
                  </dd>
                  <dt>Next attempt</dt>
                  <dd>
                    {status.health.nextAttemptAt
                      ? clockTime(status.health.nextAttemptAt) +
                        " (" +
                        duration(status.health.backoffMs) +
                        " back-off)"
                      : "On schedule"}
                  </dd>
                </dl>
              </section>
              <section className="chapter-panel" aria-labelledby="scheduler-title">
                <h2 id="scheduler-title">Scheduler</h2>
                <p>
                  <span className="badge">{status.scheduler}</span>{" "}
                  {status.nextTickAt ? "Next tick " + clockTime(status.nextTickAt) : ""}
                </p>
                <button
                  className="primary"
                  type="button"
                  disabled={busy || status.cycleInProgress}
                  onClick={() => void refresh()}
                >
                  {busy ? "Refreshing…" : "Refresh now"}
                </button>
                <h3>Recent decisions</h3>
                {status.decisions.length ? (
                  <ol className="live-decisions">
                    {status.decisions.slice(0, 6).map((d, i) => (
                      <li key={d.at + i}>
                        <span className={"badge " + (d.action === "run" ? "good" : "")}>
                          {d.action}
                        </span>{" "}
                        {d.reason}
                        <small>{clockTime(d.at)}</small>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="chapter-muted">No scheduled tick yet in this server process.</p>
                )}
              </section>
            </div>
            <CycleTable cycles={cycles} />
          </>
        )}
      </div>
    </LearningShell>
  );
}

function CycleTable({ cycles }: { cycles: RefreshCycle[] }) {
  return (
    <section className="chapter-panel" aria-labelledby="cycles-title">
      <h2 id="cycles-title">Refresh cycles</h2>
      {cycles.length === 0 ? (
        <p className="chapter-muted">
          No cycle recorded yet. Select Refresh now or wait for the scheduler.
        </p>
      ) : (
        <div className="chapter-table-wrap">
          <table>
            <caption>Newest first; each cycle is stored once and never edited.</caption>
            <thead>
              <tr>
                <th scope="col">Cycle</th>
                <th scope="col">Trigger</th>
                <th scope="col">Status</th>
                <th scope="col">Session</th>
                <th scope="col">Tasks</th>
                <th scope="col">Completed</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => (
                <tr key={cycle.id}>
                  <th scope="row" className="num">
                    #{cycle.sequence}
                  </th>
                  <td>{cycle.trigger}</td>
                  <td>
                    <span className={"badge " + (statusTone[cycle.status] ?? "")}>
                      {cycle.status}
                    </span>
                  </td>
                  <td>
                    {cycle.coversSession ? "Captured " + cycle.coversSession : "Intraday"}
                    <small>{cycle.session.basis.replaceAll("_", " ")}</small>
                  </td>
                  <td>
                    {cycle.tasks.map((task) => (
                      <span key={task.name} className="live-task">
                        <b>{task.name}</b> {task.status} · {task.detail}
                      </span>
                    ))}
                  </td>
                  <td>{clockTime(cycle.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
