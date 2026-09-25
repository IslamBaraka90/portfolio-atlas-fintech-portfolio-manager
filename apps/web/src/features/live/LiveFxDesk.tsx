import { useState, type FormEvent } from "react";
import {
  currencySchema,
  fxConversionSchema,
  refreshCycleSchema,
  type Currency,
  type FxConversion,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { ApiError, read, write } from "../../shared/api";
import { recordCycle, useLive } from "../../shared/live";
import { clockTime } from "./LiveRuntimeDesk";
import "./live.css";

const tone = {
  live: "good",
  delayed: "warning",
  closed_market: "",
  stale: "danger",
  unavailable: "danger",
};
const derivationLabel = {
  identity: "Same currency",
  direct: "Direct leg",
  inverse: "Inverse of a leg",
  cross_usd: "Cross via USD",
};

export function LiveFxDesk() {
  const { fx, status } = useLive();
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState<Currency>("GBP");
  const [to, setTo] = useState<Currency>("USD");
  const [result, setResult] = useState<FxConversion | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function convert(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResult(null);
    try {
      const query = new URLSearchParams({ amount, from, to });
      setResult((await read("/live/fx/convert?" + query, fxConversionSchema)).data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }
  async function refresh() {
    setBusy(true);
    try {
      recordCycle((await write("POST", "/live/cycles", {}, refreshCycleSchema)).data);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LearningShell active={21}>
      <div className="chapter-page live-page">
        <p className="eyebrow">Chapter 21 · Live FX</p>
        <h1>Which rate converts this holding, and how old is it?</h1>
        <p className="chapter-intro">
          The desk requests one USD leg per currency it needs and derives every other pair: direct,
          inverse or across USD. A missing leg makes a pair unavailable; nothing converts at 1:1.
        </p>
        <section className="chapter-panel" aria-labelledby="fx-board-title">
          <div className="live-panel-head">
            <h2 id="fx-board-title">FX board</h2>
            <button
              type="button"
              className="primary"
              disabled={busy || status?.cycleInProgress}
              onClick={() => void refresh()}
            >
              Refresh FX
            </button>
          </div>
          <p className="chapter-muted">
            {fx?.updatedAt
              ? "Board revision " +
                fx.revision +
                " · observed " +
                clockTime(fx.updatedAt) +
                " · " +
                (fx.source === "yahoo" ? "Yahoo Finance legs" : "authored synthetic legs")
              : "No FX yet. Quote a foreign listing, then refresh."}
          </p>
          {fx && fx.rates.length > 0 && (
            <div className="chapter-table-wrap">
              <table>
                <caption>Quote currency per one unit of base, 10 significant digits.</caption>
                <thead>
                  <tr>
                    <th scope="col">Pair</th>
                    <th scope="col" className="num">
                      Rate
                    </th>
                    <th scope="col">Derivation</th>
                    <th scope="col">Legs</th>
                    <th scope="col">Freshness</th>
                  </tr>
                </thead>
                <tbody>
                  {fx.rates.map((r) => (
                    <tr key={r.base + r.quote}>
                      <th scope="row">
                        {r.base} → {r.quote}
                      </th>
                      <td className="num">{r.quotePerBase}</td>
                      <td>
                        {derivationLabel[r.derivation]}
                        <small>{r.reasons.join(" ")}</small>
                      </td>
                      <td>
                        {r.legs.map((l) => (
                          <span key={l.symbol} className="live-task">
                            <b>{l.symbol}</b> {l.usdPerUnit} USD · {clockTime(l.providerTime)}
                          </span>
                        ))}
                      </td>
                      <td>
                        <span className={"badge " + tone[r.freshness]}>
                          {r.freshness.replace("_", " ")}
                        </span>
                        <small>as of {clockTime(r.providerTime)}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {fx && fx.unavailable.length > 0 && (
            <div className="chapter-warning" role="status">
              {fx.unavailable.map((u) => (
                <p key={u.base + u.quote}>
                  <strong>
                    {u.base} → {u.quote}:
                  </strong>{" "}
                  {u.reason}
                </p>
              ))}
            </div>
          )}
        </section>
        <section className="chapter-panel" aria-labelledby="convert-title">
          <h2 id="convert-title">Convert with the board's evidence</h2>
          <form className="chapter-form" onSubmit={(e) => void convert(e)}>
            <label>
              Amount
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              From
              <select value={from} onChange={(e) => setFrom(e.target.value as Currency)}>
                {currencySchema.options.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              To
              <select value={to} onChange={(e) => setTo(e.target.value as Currency)}>
                {currencySchema.options.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="secondary">
              Convert
            </button>
          </form>
          {error && (
            <div className="chapter-warning" role="alert">
              {error}
            </div>
          )}
          {result && (
            <div className="chapter-metrics" role="status">
              <div>
                <strong>
                  {result.converted} {result.to}
                </strong>
                <span>
                  {result.amount} {result.from} · {result.rounding} · board revision{" "}
                  {result.boardRevision}
                  {result.reasons.length ? " · " + result.reasons.join(" ") : ""}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>
    </LearningShell>
  );
}
