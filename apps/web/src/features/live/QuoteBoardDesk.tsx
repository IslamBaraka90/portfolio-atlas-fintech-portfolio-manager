import { useEffect, useState, type FormEvent } from "react";
import {
  quoteObservationSchema,
  refreshCycleSchema,
  watchlistSchema,
  type QuoteObservation,
  type Watchlist,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import { recordCycle, useLive } from "../../shared/live";
import { clockTime } from "./LiveRuntimeDesk";
import "./live.css";

const freshnessLabel: Record<QuoteObservation["freshness"], string> = {
  live: "Live",
  delayed: "Delayed",
  stale: "Stale",
  closed_market: "Market closed",
  unavailable: "Unavailable",
};
const freshnessTone: Record<QuoteObservation["freshness"], string> = {
  live: "good",
  delayed: "warning",
  stale: "danger",
  closed_market: "",
  unavailable: "danger",
};
const price = (v: number | null, digits = 2) =>
  v === null
    ? "—"
    : v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: 4 });
const signed = (v: number | null, suffix = "") =>
  v === null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + price(Math.abs(v)) + suffix;
const age = (s: number | null) =>
  s === null
    ? "—"
    : s < 90
      ? Math.round(s) + " s"
      : s < 5400
        ? Math.round(s / 60) + " min"
        : Math.round(s / 3600) + " h";

export function QuoteBoardDesk() {
  const { board, status } = useLive();
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [symbol, setSymbol] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [tape, setTape] = useState<QuoteObservation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void read("/live/watchlist", watchlistSchema)
      .then((r) => setWatchlist(r.data))
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (!selected) return;
    const abort = new AbortController();
    void read(
      "/live/quotes/" + encodeURIComponent(selected),
      quoteObservationSchema.array(),
      abort.signal,
    )
      .then((r) => setTape(r.data))
      .catch(() => undefined);
    return () => abort.abort();
  }, [selected, board?.revision]);

  async function run(label: string, action: () => Promise<void>) {
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
  const change = (action: "add" | "remove", value: string) =>
    run(action, async () => {
      if (!watchlist) return;
      const next = await write(
        "POST",
        "/live/watchlist",
        { expectedRevision: watchlist.revision, action, symbol: value },
        watchlistSchema,
      );
      setWatchlist(next.data);
      setNotice(
        (action === "add" ? "Added " : "Removed ") +
          value.toUpperCase() +
          ". The next refresh cycle quotes the updated list.",
      );
      if (action === "add") setSymbol("");
    });
  const refresh = () =>
    run("refresh", async () => {
      recordCycle((await write("POST", "/live/cycles", {}, refreshCycleSchema)).data);
      setNotice("Refresh cycle recorded.");
    });

  const quotes = board?.quotes ?? [];
  const count = (f: QuoteObservation["freshness"]) =>
    quotes.filter((q) => q.freshness === f).length;
  return (
    <LearningShell active={19}>
      <div className="chapter-page live-page">
        <p className="eyebrow">Chapter 19 · Live quotes</p>
        <h1>Is this price live, delayed or stale?</h1>
        <p className="chapter-intro">
          Every refresh cycle quotes the watchlist and your saved instruments in one request,
          validates each quote at the boundary and keeps it on an append-only tape. Freshness is a
          verdict with reasons, not a colour.
        </p>
        {error && (
          <div className="chapter-warning" role="alert">
            {error}
          </div>
        )}
        <p className="live-notice" role="status">
          {busy ? "Working…" : notice}
        </p>
        <div className="chapter-metrics" aria-label="Freshness summary">
          <div>
            <strong>{count("live")}</strong>
            <span>Live</span>
          </div>
          <div>
            <strong>{count("delayed")}</strong>
            <span>Delayed by the exchange</span>
          </div>
          <div>
            <strong>{count("stale") + count("unavailable")}</strong>
            <span>Stale or unavailable</span>
          </div>
          <div>
            <strong>{count("closed_market")}</strong>
            <span>Market closed</span>
          </div>
        </div>
        <section className="chapter-panel" aria-labelledby="board-title">
          <div className="live-panel-head">
            <h2 id="board-title">Watchlist board</h2>
            <button
              type="button"
              className="primary"
              disabled={busy || status?.cycleInProgress}
              onClick={() => void refresh()}
            >
              Refresh quotes
            </button>
          </div>
          <p className="chapter-muted">
            {board?.updatedAt
              ? "Board revision " +
                board.revision +
                " · observed " +
                clockTime(board.updatedAt) +
                " · " +
                (status?.policy.mode === "live" ? "Yahoo Finance" : "synthetic demo quotes")
              : "No quotes yet. Refresh quotes or wait for the scheduler."}
          </p>
          {quotes.length > 0 && (
            <div className="chapter-table-wrap">
              <table className="quote-board">
                <caption>
                  Prices in currency units after the recorded quote-unit scale. Change is against
                  the previous close.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Symbol</th>
                    <th scope="col" className="num">
                      Last
                    </th>
                    <th scope="col" className="num">
                      Change
                    </th>
                    <th scope="col" className="num">
                      Bid × Ask
                    </th>
                    <th scope="col" className="num">
                      Spread
                    </th>
                    <th scope="col">Freshness</th>
                    <th scope="col" className="num">
                      Age
                    </th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.symbol} aria-selected={selected === q.symbol}>
                      <th scope="row">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setSelected(q.symbol)}
                          aria-label={"Show tape for " + q.symbol}
                        >
                          {q.symbol}
                        </button>
                        <small>
                          {q.instrumentId ?? "Watchlist only"} ·{" "}
                          {q.quoteUnit.currency ?? "unit unknown"}
                        </small>
                      </th>
                      <td className="num">{price(q.last)}</td>
                      <td
                        className={
                          "num " +
                          (q.change === null ? "" : q.change >= 0 ? "positive" : "negative")
                        }
                      >
                        {signed(q.change)}
                        <small>{signed(q.changePercent, "%")}</small>
                      </td>
                      <td className="num">
                        {price(q.bid)} × {price(q.ask)}
                        <small>{q.book.state.replace("_", " ")}</small>
                      </td>
                      <td className="num">
                        {q.book.spreadBps === null ? "—" : q.book.spreadBps.toFixed(1) + " bps"}
                      </td>
                      <td>
                        <span className={"badge " + freshnessTone[q.freshness]}>
                          {freshnessLabel[q.freshness]}
                        </span>
                        <small>{q.reasons[0] ?? q.marketState ?? ""}</small>
                      </td>
                      <td className="num">
                        {age(q.ageSeconds)}
                        <small>
                          {q.delaySeconds ? "exchange delay " + q.delaySeconds / 60 + " min" : ""}
                        </small>
                      </td>
                      <td>
                        {watchlist?.symbols.includes(q.symbol) && (
                          <button
                            type="button"
                            className="secondary"
                            disabled={busy}
                            onClick={() => void change("remove", q.symbol)}
                          >
                            Remove <span className="sr-only">{q.symbol}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form
            className="chapter-form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (symbol.trim()) void change("add", symbol.trim());
            }}
          >
            <label>
              Add a symbol to the watchlist
              <input
                value={symbol}
                maxLength={40}
                placeholder={status?.policy.mode === "live" ? "e.g. NVDA or VOD.L" : "e.g. HARB"}
                onChange={(e) => setSymbol(e.target.value)}
              />
            </label>
            <button type="submit" className="secondary" disabled={busy || !watchlist}>
              Add symbol
            </button>
          </form>
          <p className="chapter-muted">
            Watchlist revision {watchlist?.revision ?? "—"} · {watchlist?.symbols.length ?? 0} of 50
            symbols. Saved instruments from Instrument discovery are quoted automatically.
          </p>
        </section>
        {selected && (
          <section className="chapter-panel" aria-labelledby="tape-title">
            <h2 id="tape-title">Quote tape · {selected}</h2>
            <div className="chapter-table-wrap">
              <table>
                <caption>Every stored observation, newest first. Nothing is overwritten.</caption>
                <thead>
                  <tr>
                    <th scope="col">Observed</th>
                    <th scope="col">Provider time</th>
                    <th scope="col" className="num">
                      Last
                    </th>
                    <th scope="col">Freshness</th>
                    <th scope="col">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {tape.slice(0, 20).map((q) => (
                    <tr key={q.id}>
                      <td>{clockTime(q.observedAt)}</td>
                      <td>{clockTime(q.providerTime)}</td>
                      <td className="num">{price(q.last)}</td>
                      <td>
                        <span className={"badge " + freshnessTone[q.freshness]}>
                          {freshnessLabel[q.freshness]}
                        </span>
                      </td>
                      <td>
                        {q.reasons.join(" ") || "No exceptions."}
                        <small>
                          {q.policy} · raw {q.sourceHash?.slice(0, 12) ?? "none"}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <p className="chapter-muted">
          Checks: stale-quote detector and crossed/locked detector (fintech-algorithms 0.13.2,
          contract tier), quoted spread (verified tier). An exchange delay extends the age budget; a
          closed market is never reported as live.
        </p>
      </div>
    </LearningShell>
  );
}
