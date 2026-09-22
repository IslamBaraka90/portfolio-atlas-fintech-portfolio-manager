import { useEffect, useState } from "react";
import { z } from "zod";
import {
  settlementPolicySchema,
  type SettlementPolicy,
  rebalanceProposalSchema,
  paperBatchSchema,
  paperEventSchema,
  type RebalanceProposal,
  type PaperBatch,
  type PaperEvent,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "../data-quality/data-quality.css";
import "../valuation/valuation.css";
import "../research/research.css";
export function OrderDesk() {
  const [policies, setPolicies] = useState<SettlementPolicy[]>([]),
    [policyId, setPolicyId] = useState("");
  const [proposals, setProposals] = useState<RebalanceProposal[]>([]),
    [batches, setBatches] = useState<PaperBatch[]>([]),
    [batch, setBatch] = useState<PaperBatch | null>(null),
    [proposalId, setProposalId] = useState(""),
    [type, setType] = useState("market"),
    [clientId, setClientId] = useState(crypto.randomUUID());
  const [orderId, setOrderId] = useState(""),
    [price, setPrice] = useState("100"),
    [capacity, setCapacity] = useState("4"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<PaperEvent | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/rebalances", z.array(rebalanceProposalSchema), abort.signal),
      read("/paper-batches", z.array(paperBatchSchema), abort.signal),
      read("/settlement-policies", z.array(settlementPolicySchema), abort.signal),
    ])
      .then(([p, b, calendars]) => {
        setPolicies(calendars.data);
        setProposals(p.data);
        setBatches(b.data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  function accept(b: PaperBatch) {
    setBatch(b);
    setBatches((rows) => [...rows.filter((r) => r.id !== b.id), b]);
    if (!b.orders.some((o) => o.id === orderId)) {
      setOrderId(b.orders[0]?.id ?? "");
      setPrice(b.orders[0]?.protectionPrice ?? "100");
    }
  }
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const p = proposals.find((p) => p.id === proposalId)!;
      accept(
        (
          await write(
            "POST",
            "/paper-batches",
            {
              proposal: { id: p.id, revision: p.revision },
              clientBatchId: clientId,
              orderType: type,
              settlementPolicy: policyId ? { id: policyId, revision: 1 } : null,
            },
            paperBatchSchema,
          )
        ).data,
      );
      setClientId(crypto.randomUUID());
      setProposalId("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function event(input: PaperEvent) {
    if (!batch) return;
    setBusy(true);
    setError("");
    setPending(input);
    try {
      accept(
        (await write("POST", "/paper-batches/" + batch.id + "/events", input, paperBatchSchema))
          .data,
      );
      setPending(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function send(kind: PaperEvent["kind"]) {
    if (!batch) return;
    try {
      await event(
        paperEventSchema.parse({
          eventId: crypto.randomUUID(),
          expectedRevision: batch.revision,
          orderId,
          kind,
          opening:
            kind === "opening"
              ? { at: new Date().toISOString(), price, capacity: Number(capacity) }
              : null,
        }),
      );
    } catch (e) {
      setError(String(e));
    }
  }
  async function reload() {
    if (!batch) return;
    setBusy(true);
    try {
      accept((await read("/paper-batches/" + batch.id, paperBatchSchema)).data);
      setPending(null);
      setError("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const order = batch?.orders.find((o) => o.id === orderId),
    terminal = order && ["filled", "cancelled", "rejected"].includes(order.state),
    disabled = busy || pending !== null;
  return (
    <LearningShell active={12}>
      <div className="chapter-page research-page">
        <div className="chapter-kicker">CHAPTER 12 · PAPER EXECUTION</div>
        <h1>Follow the order.</h1>
        <p className="chapter-intro">
          Approval is a decision. Acceptance commits resources. A fill changes the book.
          Cancellation needs an acknowledgment.
        </p>
        {error && (
          <div role="alert" className="chapter-warning">
            {error}
            {pending && (
              <button className="secondary" disabled={busy} onClick={() => void event(pending)}>
                Retry last event
              </button>
            )}
          </div>
        )}
        <section className="chapter-panel">
          <h2>Submit an approved proposal</h2>
          <div className="chapter-form">
            <label>
              Execution proposal
              <select value={proposalId} onChange={(e) => setProposalId(e.target.value)}>
                <option value="">Select an unused approval</option>
                {proposals
                  .filter(
                    (p) => p.status === "approved" && !batches.some((b) => b.proposal.id === p.id),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id.slice(0, 8)} · {p.trades.length} trades · {p.portfolioId.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Paper order type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="market">Protected market</option>
                <option value="limit">Limit at proposal price</option>
              </select>
            </label>
            <label>
              Settlement policy
              <select value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
                <option value="">Immediate teaching settlement</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} � {p.lagBusinessDays} business days
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={busy || !proposalId}
              onClick={() => void submit()}
            >
              Submit paper batch
            </button>
          </div>
          <p>
            One active batch locks manual book writes for its portfolio. Accept funding sells before
            buys. Current cash must support each accepted reservation.
          </p>
          <label>
            Saved paper batch
            <select
              value={batch?.id ?? ""}
              disabled={busy}
              onChange={(e) => {
                const b = batches.find((b) => b.id === e.target.value);
                if (b) accept(b);
                else setBatch(null);
                setPending(null);
                setError("");
              }}
            >
              <option value="">Select a batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.clientBatchId} · {b.status} · r{b.revision}
                </option>
              ))}
            </select>
          </label>
        </section>
        {batch && (
          <section className="chapter-panel" data-testid="paper-result">
            <h2>Paper batch: {batch.status}</h2>
            <p>
              Revision {batch.revision}; expected book checkpoint {batch.expectedBookCheckpoint};
              approval {batch.proposal.id.slice(0, 8)} r{batch.proposal.revision}.
            </p>
            <button className="secondary" disabled={busy} onClick={() => void reload()}>
              Reload paper state
            </button>
            <div className="chapter-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Side</th>
                    <th>State</th>
                    <th>Filled</th>
                    <th>Remaining</th>
                    <th>Cash committed</th>
                    <th>Shares committed</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <button
                          className="secondary"
                          onClick={() => {
                            setOrderId(o.id);
                            setPrice(o.protectionPrice);
                          }}
                          disabled={disabled}
                          aria-label={"Inspect paper order " + o.instrumentId}
                        >
                          {o.instrumentId}
                        </button>
                      </td>
                      <td>{o.side}</td>
                      <td>{o.state}</td>
                      <td>{o.filledQuantity}</td>
                      <td>{o.remainingQuantity}</td>
                      <td>{o.cashReserved}</td>
                      <td>{o.sharesCommitted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {order && (
              <article data-testid="paper-order">
                <h3>Order state: {order.state}</h3>
                <p>
                  {order.clientOrderId}. {order.side} {order.quantity} {order.instrumentId}.
                  Protection {order.protectionPrice}; lot {order.lotSize}; tick {order.tickSize}.
                </p>
                <div className="chapter-form">
                  <button
                    className="primary"
                    disabled={disabled || order.state !== "submitted"}
                    onClick={() => void send("accept")}
                  >
                    Broker accepts order
                  </button>
                  <button
                    className="secondary"
                    disabled={disabled || terminal || order.state === "cancel_pending"}
                    onClick={() => void send("cancel_request")}
                  >
                    Request cancellation
                  </button>
                  <button
                    className="secondary"
                    disabled={
                      disabled || !(order.state === "cancel_pending" || order.state === "filled")
                    }
                    onClick={() => void send("cancel_ack")}
                  >
                    Acknowledge cancellation
                  </button>
                  <button
                    className="secondary"
                    disabled={disabled || terminal}
                    onClick={() => void send("reject")}
                  >
                    Broker rejects remainder
                  </button>
                </div>
                <h3>Authored opening event</h3>
                <p>
                  This is a hypothetical opening slice of a daily bar. The button records the
                  current UTC time, which must follow acceptance. High/low touches, queue priority
                  and observed market fills are not inferred.
                </p>
                <div className="chapter-form">
                  <label>
                    Paper opening price
                    <input value={price} onChange={(e) => setPrice(e.target.value)} />
                  </label>
                  <label>
                    Opening available shares
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={disabled || !order.acceptedAt || terminal}
                    onClick={() => void send("opening")}
                  >
                    Simulate opening event
                  </button>
                </div>
                <div className="chapter-metrics">
                  <div>
                    <strong>{order.filledQuantity}</strong>
                    <span>FILLED SHARES</span>
                  </div>
                  <div>
                    <strong>{order.remainingQuantity}</strong>
                    <span>REMAINING SHARES</span>
                  </div>
                  <div>
                    <strong>{order.cashReserved}</strong>
                    <span>CASH RESERVED</span>
                  </div>
                  <div>
                    <strong>{order.fees}</strong>
                    <span>CUMULATIVE FEES</span>
                  </div>
                </div>
                <p>
                  Average fill price:{" "}
                  {order.averagePrice === null ? "unavailable" : order.averagePrice.toFixed(6)}.
                  Actual notional: {order.filledNotional}. Fees are rounded cumulatively, then only
                  the increment is posted.
                </p>
                <h3>Fill history</h3>
                {!order.fills.length && <p>No fills recorded.</p>}
                <div className="chapter-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Opening time</th>
                        <th>Recorded time</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Fee</th>
                        <th>Accounting</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.fills.map((f) => (
                        <tr key={f.id}>
                          <td>{f.eventId.slice(0, 8)}</td>
                          <td>{f.at}</td>
                          <td>{f.recordedAt}</td>
                          <td>{f.quantity}</td>
                          <td>{f.price}</td>
                          <td>{f.fee}</td>
                          <td>
                            {f.settlementPolicy}
                            <small>Journal event {f.ledgerEventId}</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3>Lifecycle and controls</h3>
                <ol>
                  {order.history.map((h, i) => (
                    <li key={i}>
                      <strong>
                        {h.kind} → {h.state}
                      </strong>
                      <p>
                        {h.at} · {h.reason}
                      </p>
                    </li>
                  ))}
                </ol>
                <ul>
                  {order.checks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </article>
            )}
            <h3>Simulation limits</h3>
            <ul>
              {batch.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p>
              Package 0.13.2: verified tick and residual algorithms. The application owns
              orchestration, reservations and replay.
            </p>
          </section>
        )}
      </div>
    </LearningShell>
  );
}
