import { useEffect, useState } from "react";
import {
  executionCostSchema,
  paperBatchSchema,
  refreshCycleSchema,
  type ExecutionCost,
  type PaperBatch,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import { recordCycle, useLive } from "../../shared/live";
import { clockTime } from "./LiveRuntimeDesk";
import "./live.css";

const stateTone: Record<string, string> = {
  filled: "good",
  partially_filled: "warning",
  accepted: "",
  rejected: "danger",
  cancelled: "",
};

export function LiveFillsDesk() {
  const { cycles, status } = useLive();
  const [batches, setBatches] = useState<PaperBatch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [costs, setCosts] = useState<ExecutionCost[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lastCycle = cycles[0]?.id;

  useEffect(() => {
    void read("/paper-batches", paperBatchSchema.array())
      .then((r) => {
        setBatches(r.data);
        if (r.data.length) setBatchId((id) => id || r.data.at(-1)!.id);
      })
      .catch((e) => setError(String(e)));
  }, [lastCycle]);
  useEffect(() => {
    if (!batchId) return;
    void read("/paper-batches/" + batchId + "/costs", executionCostSchema.array())
      .then((r) => setCosts(r.data))
      .catch(() => undefined);
  }, [batchId, lastCycle]);

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
  const batch = batches.find((b) => b.id === batchId);
  const paperTask = cycles[0]?.tasks.find((t) => t.name === "paper");
  return (
    <LearningShell active={24}>
      <div className="chapter-page live-page">
        <p className="eyebrow">Chapter 24 · Live fills</p>
        <h1>What would this order have cost at the market's actual prices?</h1>
        <p className="chapter-intro">
          Accepted paper orders are offered their live quote every cycle: buys at the ask, sells at
          the bid, capped by the displayed size. Closed markets and stale quotes wait. The Chapter
          12 protection still applies, so a quote that moved against the decision is rejected.
        </p>
        {error && (
          <div className="chapter-warning" role="alert">
            {error}
          </div>
        )}
        {paperTask && (
          <p className="chapter-notice" role="status">
            Last cycle: {paperTask.detail}
          </p>
        )}
        {batches.length === 0 ? (
          <p className="chapter-muted">
            No paper batches yet. Approve a rebalance priced at the executable side (the ask for
            buys), submit it in Paper execution and accept its orders.
          </p>
        ) : (
          <section className="chapter-panel" aria-labelledby="blotter-title">
            <div className="live-panel-head">
              <h2 id="blotter-title">Live blotter</h2>
              <button
                type="button"
                className="primary"
                disabled={busy || status?.cycleInProgress}
                onClick={() => void refresh()}
              >
                Offer live quotes
              </button>
            </div>
            <div className="chapter-form">
              <label>
                Paper batch
                <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.clientBatchId} · {b.status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {batch && (
              <div className="chapter-table-wrap">
                <table>
                  <caption>Orders and their fills. Fill evidence names the quote used.</caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">State</th>
                      <th scope="col" className="num">
                        Filled / ordered
                      </th>
                      <th scope="col">Fills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.orders.map((o) => (
                      <tr key={o.id}>
                        <th scope="row">
                          {o.side} {o.instrumentId}
                          <small>
                            {o.orderType} · decision {Number(o.protectionPrice).toFixed(2)}
                          </small>
                        </th>
                        <td>
                          <span className={"badge " + (stateTone[o.state] ?? "")}>
                            {o.state.replace("_", " ")}
                          </span>
                          <small>{o.history.at(-1)?.reason}</small>
                        </td>
                        <td className="num">
                          {Number(o.filledQuantity)} / {Number(o.quantity)}
                        </td>
                        <td>
                          {o.fills.length === 0
                            ? "No fills"
                            : o.fills.map((f) => (
                                <span key={f.id} className="live-task">
                                  <b>
                                    {f.source === "live_quote_paper_fill"
                                      ? f.live?.basis
                                      : "authored"}
                                  </b>{" "}
                                  {Number(f.quantity)} @ {Number(f.price).toFixed(2)} ·{" "}
                                  {clockTime(f.at)}
                                  {f.live ? " · quote " + clockTime(f.live.providerTime) : ""}
                                </span>
                              ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {costs.length > 0 && (
          <section className="chapter-panel" aria-labelledby="costs-title">
            <h2 id="costs-title">Execution costs</h2>
            <div className="chapter-table-wrap">
              <table>
                <caption>
                  Shortfall against the approved decision price; positive is a cost.{" "}
                  {costs[0]!.method}.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col" className="num">
                      Average fill
                    </th>
                    <th scope="col" className="num">
                      Shortfall
                    </th>
                    <th scope="col" className="num">
                      Spread cost
                    </th>
                    <th scope="col" className="num">
                      Fees
                    </th>
                    <th scope="col" className="num">
                      Total (bps)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((c) => (
                    <tr key={c.orderId}>
                      <th scope="row">
                        {c.side} {c.instrumentId}
                        <small>{c.liveFills} live fill(s)</small>
                      </th>
                      <td className="num">
                        {c.averageFill === null ? "—" : Number(c.averageFill).toFixed(4)}
                      </td>
                      <td className="num">{c.shortfall}</td>
                      <td className="num">{c.spreadCost ?? "—"}</td>
                      <td className="num">{c.fees}</td>
                      <td className="num">
                        {c.totalCost}
                        <small>{c.totalCostBps === null ? "" : c.totalCostBps + " bps"}</small>
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
