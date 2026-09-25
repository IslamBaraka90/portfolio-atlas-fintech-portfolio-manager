import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  liveBarSchema,
  liveSeriesSchema,
  refreshCycleSchema,
  type LiveBar,
  type LiveInterval,
  type LiveSeries,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import { recordCycle, useLive } from "../../shared/live";
import { clockTime } from "./LiveRuntimeDesk";
import "./live.css";

const barsResponse = z.object({ series: liveSeriesSchema.nullable(), bars: liveBarSchema.array() });
const price = (v: number | null) =>
  v === null
    ? "—"
    : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

export function LiveHistoryDesk() {
  const { seriesRevisions, status } = useLive();
  const [series, setSeries] = useState<LiveSeries[]>([]);
  const [symbol, setSymbol] = useState("");
  const [interval, setSeriesInterval] = useState<LiveInterval | "">("");
  const [bars, setBars] = useState<LiveBar[]>([]);
  const [head, setHead] = useState<LiveSeries | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedId = symbol + "|" + interval;

  useEffect(() => {
    void read("/live/series", liveSeriesSchema.array())
      .then((r) => {
        setSeries(r.data);
        if (!symbol && r.data[0]) {
          const intraday = r.data.find((s) => s.interval !== "1d") ?? r.data[0];
          setSymbol(intraday.symbol);
          setSeriesInterval(intraday.interval);
        }
      })
      .catch((e) => setError(String(e)));
    // Series ids appear as the scheduler or a manual refresh records them.
  }, [Object.keys(seriesRevisions).length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!symbol || !interval) return;
    const abort = new AbortController();
    void read(
      "/live/series/" + encodeURIComponent(symbol) + "/" + interval + "/bars?limit=120",
      barsResponse,
      abort.signal,
    )
      .then((r) => {
        setBars(r.data.bars);
        setHead(r.data.series);
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [symbol, interval, seriesRevisions[selectedId]]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const symbols = [...new Set(series.map((s) => s.symbol))];
  const intervals = series.filter((s) => s.symbol === symbol).map((s) => s.interval);
  return (
    <LearningShell active={20}>
      <div className="chapter-page live-page">
        <p className="eyebrow">Chapter 20 · Live history</p>
        <h1>When is a live bar final?</h1>
        <p className="chapter-intro">
          Each cycle requests only the tail of every series. New bars are appended, a forming bar is
          revised until its interval ends, and a final bar never changes again.
        </p>
        {error && (
          <div className="chapter-warning" role="alert">
            {error}
          </div>
        )}
        <section className="chapter-panel" aria-labelledby="series-title">
          <div className="live-panel-head">
            <h2 id="series-title">Series</h2>
            <button
              type="button"
              className="primary"
              disabled={busy || status?.cycleInProgress}
              onClick={() => void refresh()}
            >
              Refresh history
            </button>
          </div>
          {series.length === 0 ? (
            <p className="chapter-muted">
              No series yet. Refresh history or wait for the scheduler.
            </p>
          ) : (
            <div className="chapter-form">
              <label>
                Symbol
                <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                  {symbols.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Interval
                <select
                  value={interval}
                  onChange={(e) => setSeriesInterval(e.target.value as LiveInterval)}
                >
                  {intervals.map((i) => (
                    <option key={i} value={i}>
                      {i === "1d" ? "Daily" : i}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {head && (
            <>
              <div className="chapter-metrics">
                <div>
                  <strong>{head.counts.final}</strong>
                  <span>Final bars</span>
                </div>
                <div>
                  <strong>{head.counts.forming}</strong>
                  <span>Forming</span>
                </div>
                <div>
                  <strong>{head.counts.quarantined}</strong>
                  <span>Quarantined</span>
                </div>
                <div>
                  <strong>
                    +{head.lastRefresh.appended} / {head.lastRefresh.finalized}
                  </strong>
                  <span>Appended / finalized in the last refresh</span>
                </div>
              </div>
              <CandleView bars={bars} />
              <p className="chapter-muted">
                Revision {head.revision} · refreshed {clockTime(head.refreshedAt)} ·{" "}
                {head.quoteUnit.currency ?? "unit unknown"} · {head.timezone ?? "timezone unknown"}{" "}
                · policy <code>{head.policy}</code>. {head.warnings.join(" ")}
              </p>
            </>
          )}
        </section>
        {bars.length > 0 && (
          <section className="chapter-panel" aria-labelledby="bars-title">
            <h2 id="bars-title">Latest bars</h2>
            <div className="chapter-table-wrap">
              <table>
                <caption>Newest first. A bar keeps every revision it ever had.</caption>
                <thead>
                  <tr>
                    <th scope="col">Start</th>
                    <th scope="col" className="num">
                      Open
                    </th>
                    <th scope="col" className="num">
                      High
                    </th>
                    <th scope="col" className="num">
                      Low
                    </th>
                    <th scope="col" className="num">
                      Close
                    </th>
                    <th scope="col">Finality</th>
                    <th scope="col">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {[...bars]
                    .reverse()
                    .slice(0, 12)
                    .map((b) => (
                      <tr key={b.timestamp}>
                        <td>
                          {clockTime(b.timestamp)}
                          <small>revision {b.revision}</small>
                        </td>
                        <td className="num">{price(b.open)}</td>
                        <td className="num">{price(b.high)}</td>
                        <td className="num">{price(b.low)}</td>
                        <td className="num">{price(b.close)}</td>
                        <td>
                          <span
                            className={
                              "badge " +
                              (!b.accepted ? "danger" : b.finality === "final" ? "good" : "warning")
                            }
                          >
                            {!b.accepted
                              ? "Quarantined"
                              : b.finality === "final"
                                ? "Final"
                                : "Forming"}
                          </span>
                          <small>{b.finalityEvidence}</small>
                        </td>
                        <td>
                          {b.findings
                            .filter((f) => f.code !== "INFERRED_TICK")
                            .map((f) => f.reason)
                            .join(" ") || "No exceptions."}
                        </td>
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

// Final bars are solid; the forming bar is an outlined accent so it never reads as
// settled. Quarantined bars are marked, not drawn as prices.
function CandleView({ bars }: { bars: LiveBar[] }) {
  const shown = bars.slice(-60);
  const prices = shown.flatMap((b) => (b.accepted && b.low !== null ? [b.low, b.high!] : []));
  const layout = useMemo(() => {
    const min = Math.min(...prices),
      max = Math.max(...prices);
    const span = max - min || 1;
    return {
      min,
      max,
      y: (v: number) => 200 - ((v - min) / span) * 170,
      x: (i: number) => 40 + i * (680 / Math.max(1, shown.length)),
      w: Math.max(3, 680 / Math.max(1, shown.length) - 4),
    };
  }, [shown.length, prices.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!prices.length) return null;
  return (
    <figure className="chart-frame">
      <svg
        viewBox="0 0 740 240"
        role="img"
        aria-label="Live candles. Final bars are solid; the forming bar is outlined."
      >
        <line className="chart-grid" x1="30" x2="730" y1="210" y2="210" />
        <text x="30" y="24">
          {price(layout.max)}
        </text>
        <text x="30" y="232">
          {price(layout.min)}
        </text>
        {shown.map((b, i) => {
          const cx = layout.x(i) + layout.w / 2;
          if (!b.accepted || b.open === null || b.close === null)
            return (
              <text key={b.timestamp} x={cx} y="205" textAnchor="middle" className="chart-label">
                ×
              </text>
            );
          const top = layout.y(Math.max(b.open, b.close)),
            bottom = layout.y(Math.min(b.open, b.close));
          const forming = b.finality !== "final";
          return (
            <g key={b.timestamp}>
              <line
                className={forming ? "chart-accent" : "chart-series"}
                x1={cx}
                x2={cx}
                y1={layout.y(b.high!)}
                y2={layout.y(b.low!)}
              />
              <rect
                x={layout.x(i)}
                y={top}
                width={layout.w}
                height={Math.max(1.5, bottom - top)}
                className={forming ? "chart-accent" : "chart-series-fill"}
                fill={forming ? "none" : undefined}
                strokeWidth={forming ? 2 : 0}
              />
            </g>
          );
        })}
      </svg>
      <figcaption>
        Showing the latest {shown.length} bars. Solid: final. Outlined: forming. ×: quarantined.
      </figcaption>
    </figure>
  );
}
