import { useEffect, useState } from "react";
import { z } from "zod";
import {
  navPointSchema,
  portfolioSchema,
  valuationSnapshotSchema,
  type NavPoint,
  type Portfolio,
  type ValuationSnapshot,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import { useLive } from "../../shared/live";
import { clockTime } from "./LiveRuntimeDesk";
import "./live.css";

const navResponse = z.object({
  points: navPointSchema.array(),
  latest: z.object({ point: navPointSchema, valuation: valuationSnapshotSchema }).nullable(),
});
const basisLabel: Record<string, string> = {
  last: "Last trade",
  mid: "Midpoint",
  close: "Close",
  dataset: "Dataset row",
  override: "Override",
};
const money = (v: string | null, currency: string) =>
  v === null
    ? "Unavailable"
    : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
      " " +
      currency;

export function LivePortfolioDesk() {
  const { navUpdates, status } = useLive();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfolioId, setPortfolioId] = useState("");
  const [points, setPoints] = useState<NavPoint[]>([]);
  const [latest, setLatest] = useState<ValuationSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void read("/portfolios", z.array(portfolioSchema))
      .then((r) => {
        setPortfolios(r.data);
        if (r.data[0]) setPortfolioId((id) => id || r.data.at(-1)!.id);
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (!portfolioId) return;
    const abort = new AbortController();
    void read("/portfolios/" + portfolioId + "/live-nav", navResponse, abort.signal)
      .then((r) => {
        setPoints(r.data.points);
        setLatest(r.data.latest?.valuation ?? null);
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [portfolioId, navUpdates[portfolioId]]); // eslint-disable-line react-hooks/exhaustive-deps

  async function valueNow() {
    setBusy(true);
    setError("");
    try {
      const point = (
        await write("POST", "/portfolios/" + portfolioId + "/live-valuations", {}, navPointSchema)
      ).data;
      const r = await read("/portfolios/" + portfolioId + "/live-nav", navResponse);
      setPoints(r.data.points);
      setLatest(r.data.latest?.valuation ?? null);
      if (point.status === "incomplete")
        setError("Valuation is incomplete: at least one holding or currency has no usable price.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  const ccy = latest?.baseCurrency ?? "";
  return (
    <LearningShell active={22}>
      <div className="chapter-page live-page">
        <p className="eyebrow">Chapter 22 · Live portfolio</p>
        <h1>What is the portfolio worth right now?</h1>
        <p className="chapter-intro">
          Every cycle marks each holding from its live quote under a declared policy, converts with
          the live FX board, and adds a NAV point only when something changed. Every number links
          back to the quote it came from.
        </p>
        {error && (
          <div className="chapter-warning" role="alert">
            {error}
          </div>
        )}
        {portfolios.length === 0 ? (
          <p className="chapter-notice">
            Create a portfolio in the Mandate lab and post a deposit and a purchase in the Portfolio
            book, then return here.
          </p>
        ) : (
          <section className="chapter-panel" aria-labelledby="account-title">
            <div className="live-panel-head">
              <h2 id="account-title">Account summary</h2>
              <button
                type="button"
                className="primary"
                disabled={busy || !portfolioId || status?.cycleInProgress}
                onClick={() => void valueNow()}
              >
                Value now
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
            {latest ? (
              <>
                <div className="chapter-metrics">
                  <div>
                    <strong>{money(latest.totals.nav, ccy)}</strong>
                    <span>Net asset value · {latest.status}</span>
                  </div>
                  <div>
                    <strong>{money(latest.totals.holdingsBase, ccy)}</strong>
                    <span>
                      Holdings · {latest.coverage.valuedHoldings} of {latest.coverage.totalHoldings}{" "}
                      marked
                    </span>
                  </div>
                  <div>
                    <strong>{money(latest.totals.cashBase, ccy)}</strong>
                    <span>Economic cash</span>
                  </div>
                  <div>
                    <strong>{points.length}</strong>
                    <span>NAV points · as of {clockTime(latest.request.asOf)}</span>
                  </div>
                </div>
                <NavChart points={points} currency={ccy} />
              </>
            ) : (
              <p className="chapter-muted">
                No live valuation yet. Select Value now or wait for the next refresh cycle.
              </p>
            )}
          </section>
        )}
        {latest && latest.positions.length > 0 && (
          <section className="chapter-panel" aria-labelledby="holdings-title">
            <h2 id="holdings-title">Holdings and mark evidence</h2>
            <div className="chapter-table-wrap">
              <table>
                <caption>
                  Policy {latest.policyVersion}. Book checkpoint {latest.request.checkpoint}.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Holding</th>
                    <th scope="col" className="num">
                      Quantity
                    </th>
                    <th scope="col" className="num">
                      Mark
                    </th>
                    <th scope="col">Basis</th>
                    <th scope="col" className="num">
                      Value ({ccy})
                    </th>
                    <th scope="col">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.positions.map((p) => (
                    <tr key={p.instrumentId}>
                      <th scope="row">
                        {p.instrumentId}
                        <small>{p.currency}</small>
                      </th>
                      <td className="num">{Number(p.quantity).toLocaleString("en-US")}</td>
                      <td className="num">
                        {p.mark.price === null ? "—" : Number(p.mark.price).toFixed(2)}
                        <small>{clockTime(p.mark.quotedAt)}</small>
                      </td>
                      <td>
                        <span
                          className={"badge " + (p.mark.status === "accepted" ? "good" : "danger")}
                        >
                          {p.mark.basis ? basisLabel[p.mark.basis] : p.mark.status}
                        </span>
                      </td>
                      <td className="num">
                        {p.marketValueBase === null ? "Unavailable" : p.marketValueBase}
                        {p.fxId && <small>FX {p.fxId}</small>}
                      </td>
                      <td>{p.reasons.join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </LearningShell>
  );
}

function NavChart({ points, currency }: { points: NavPoint[]; currency: string }) {
  const valued = points.filter((p) => p.nav !== null);
  if (valued.length < 2)
    return (
      <p className="chapter-muted">
        The NAV line appears after the second valued point. Points are added only when marks, rates
        or the book change.
      </p>
    );
  const values = valued.map((p) => Number(p.nav));
  const min = Math.min(...values),
    max = Math.max(...values),
    span = max - min || 1;
  const x = (i: number) => 40 + (i * 660) / (valued.length - 1);
  const y = (v: number) => 180 - ((v - min) / span) * 150;
  return (
    <figure className="chart-frame">
      <svg viewBox="0 0 740 220" role="img" aria-label={"Live NAV in " + currency}>
        <line className="chart-grid" x1="30" x2="720" y1="190" y2="190" />
        <polyline
          className="chart-series"
          fill="none"
          strokeWidth="3"
          points={values.map((v, i) => x(i) + "," + y(v)).join(" ")}
        />
        <circle
          className="chart-accent-fill"
          cx={x(values.length - 1)}
          cy={y(values.at(-1)!)}
          r="5"
        />
        <text x="30" y="22">
          {max.toFixed(2)} {currency}
        </text>
        <text x="30" y="212">
          {min.toFixed(2)} {currency}
        </text>
      </svg>
      <figcaption>
        {valued.length} valued NAV points from {clockTime(valued[0]!.asOf)} to{" "}
        {clockTime(valued.at(-1)!.asOf)}. The accent dot is the latest point.
      </figcaption>
    </figure>
  );
}
