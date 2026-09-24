import { useApprovalPermission } from "../../shared/use-approval";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  targetSnapshotSchema,
  valuationSnapshotSchema,
  rebalanceRequestSchema,
  rebalanceProposalSchema,
  type TargetSnapshot,
  type ValuationSnapshot,
  type RebalanceProposal,
  type RebalanceRequest,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "../valuation/valuation.css";
import "../research/research.css";
const pct = (v: number) => (v * 100).toFixed(3) + "%";
export function RebalanceDesk() {
  const [targets, setTargets] = useState<TargetSnapshot[]>([]),
    [values, setValues] = useState<ValuationSnapshot[]>([]),
    [proposals, setProposals] = useState<RebalanceProposal[]>([]);
  const [targetId, setTargetId] = useState(""),
    [valueId, setValueId] = useState(""),
    [proposal, setProposal] = useState<RebalanceProposal | null>(null),
    [trigger, setTrigger] = useState<RebalanceRequest["trigger"]>("manual"),
    [due, setDue] = useState(new Date().toISOString()),
    [threshold, setThreshold] = useState("0.05"),
    [fee, setFee] = useState("10"),
    [minimum, setMinimum] = useState("10"),
    [coefficient, setCoefficient] = useState("0.2");
  const [prices, setPrices] = useState<Record<string, string>>({}),
    [quoted, setQuoted] = useState(new Date().toISOString()),
    [reason, setReason] = useState("Authored synthetic teaching price in current book share units"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      read("/targets", z.array(targetSnapshotSchema), abort.signal),
      read("/valuations", z.array(valuationSnapshotSchema), abort.signal),
      read("/rebalances", z.array(rebalanceProposalSchema), abort.signal),
    ])
      .then(([t, v, p]) => {
        setTargets(t.data);
        setValues(v.data);
        setProposals(p.data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e));
      });
    return () => abort.abort();
  }, []);
  const target = targets.find((t) => t.id === targetId),
    valuation = values.find((v) => v.id === valueId),
    newAssets =
      target?.instruments.filter(
        (i) => !valuation?.positions.some((p) => p.instrumentId === i.instrumentId),
      ) ?? [];
  function accept(p: RebalanceProposal) {
    setProposal(p);
    setProposals((rows) => [...rows.filter((r) => r.id !== p.id), p]);
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      accept(
        (
          await write(
            "POST",
            "/rebalances",
            rebalanceRequestSchema.parse({
              target: { id: targetId, revision: 1 },
              valuation: { id: valueId, revision: 1 },
              trigger,
              dueAt: trigger === "calendar" ? due : null,
              driftThreshold: Number(threshold),
              minTrade: minimum,
              feeBps: Number(fee),
              illustrativeCoefficient: Number(coefficient),
              newPrices: newAssets.map((i) => ({
                instrumentId: i.instrumentId,
                currency: target!.mandate.baseCurrency,
                price: prices[i.instrumentId] ?? "100",
                quotedAt: quoted,
                sourceRef: "rebalance-desk-authored-price",
                reason,
              })),
            }),
            rebalanceProposalSchema,
          )
        ).data,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const canApprove = useApprovalPermission("rebalance", proposal?.id, proposal?.revision);
  async function approve() {
    if (!proposal) return;
    setBusy(true);
    setError("");
    try {
      accept(
        (
          await write(
            "POST",
            "/rebalances/" + proposal.id + "/approval",
            { expectedRevision: proposal.revision },
            rebalanceProposalSchema,
          )
        ).data,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LearningShell active={11}>
      <div className="chapter-page research-page">
        <div className="chapter-kicker">CHAPTER 11 · REBALANCING</div>
        <h1>From weights to quantities.</h1>
        <p className="chapter-intro">
          Make costs, cash reserves and the lots behind each sale visible before approving a
          paper-trade proposal.
        </p>
        {error && (
          <div role="alert" className="chapter-warning">
            {error}
          </div>
        )}
        <section className="chapter-panel">
          <h2>Prepare a rebalance</h2>
          <div className="chapter-form">
            <label>
              Rebalance target
              <select
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.target.value);
                  setValueId("");
                }}
              >
                <option value="">Select a successful target</option>
                {targets
                  .filter((t) => t.status === "proposal")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.request.method} · {t.id.slice(0, 8)} · {t.request.portfolioId.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Rebalance valuation
              <select value={valueId} onChange={(e) => setValueId(e.target.value)}>
                <option value="">Select latest complete valuation</option>
                {values
                  .filter((v) => v.request.portfolioId === target?.request.portfolioId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      Checkpoint {v.book.checkpoint} · {v.status} · {v.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Rebalance trigger
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as typeof trigger)}
              >
                <option value="manual">Manual review</option>
                <option value="calendar">Calendar due time</option>
                <option value="drift">Weight drift threshold</option>
                <option value="cash_flow">Cash-flow-first, buys only</option>
              </select>
            </label>
            {trigger === "calendar" && (
              <label>
                Due time (UTC ISO)
                <input value={due} onChange={(e) => setDue(e.target.value)} />
              </label>
            )}
            {trigger === "drift" && (
              <label>
                Drift threshold fraction
                <input
                  type="number"
                  min="0"
                  max="1"
                  step=".01"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </label>
            )}
            <label>
              Rebalance fee bps
              <input
                type="number"
                min="0"
                max="500"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </label>
            <label>
              Minimum trade amount
              <input value={minimum} onChange={(e) => setMinimum(e.target.value)} />
            </label>
            <label>
              Illustrative lot coefficient
              <input
                type="number"
                min="0"
                max="1"
                step=".01"
                value={coefficient}
                onChange={(e) => setCoefficient(e.target.value)}
              />
            </label>
          </div>
          {target && valuation && (
            <>
              <h3>Execution marks</h3>
              <p>
                Held prices come from the selected valuation. New instruments use explicit authored
                synthetic prices. Every mark must be less than one hour old and fit its tick size.
              </p>
              <div className="chapter-form">
                {newAssets.map((i) => (
                  <label key={i.instrumentId}>
                    {i.returnedSymbol} teaching price
                    <input
                      value={prices[i.instrumentId] ?? "100"}
                      onChange={(e) => setPrices({ ...prices, [i.instrumentId]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              {newAssets.length > 0 && (
                <div className="valuation-fields">
                  <label>
                    Teaching price time (UTC ISO)
                    <input value={quoted} onChange={(e) => setQuoted(e.target.value)} />
                  </label>
                  <label>
                    Teaching price reason
                    <input value={reason} onChange={(e) => setReason(e.target.value)} />
                  </label>
                </div>
              )}
            </>
          )}
          <p>
            Whole-lot sizing uses a conservative fee buffer. FIFO is the executable book policy; a
            D14 score comparison does not change tax or cash.
          </p>
          <button
            className="primary"
            disabled={busy || !target || !valuation}
            onClick={() => void create()}
          >
            Build rebalance proposal
          </button>
          <label>
            Saved rebalance proposal
            <select
              value={proposal?.id ?? ""}
              onChange={(e) => setProposal(proposals.find((p) => p.id === e.target.value) ?? null)}
            >
              <option value="">Select a proposal</option>
              {proposals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.status} · revision {p.revision} · {p.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        </section>
        {proposal && (
          <section className="chapter-panel" data-testid="rebalance-result">
            <h2>Rebalance: {proposal.status}</h2>
            <p>
              Frozen target {proposal.target.id.slice(0, 8)}, valuation{" "}
              {proposal.valuation.id.slice(0, 8)}, book checkpoint{" "}
              {proposal.valuation.book.checkpoint}. Expires {proposal.expiresAt}.
            </p>
            <p>
              Trigger {proposal.request.trigger}; fee {proposal.request.feeBps} bps; minimum{" "}
              {proposal.request.minTrade}; illustrative coefficient{" "}
              {proposal.request.illustrativeCoefficient}.
            </p>
            {proposal.reasons.map((r) => (
              <p className="chapter-warning" key={r}>
                {r}
              </p>
            ))}
            <div className="chapter-metrics">
              <div>
                <strong>{proposal.startingNav}</strong>
                <span>STARTING NAV</span>
              </div>
              <div>
                <strong>{proposal.projectedNav}</strong>
                <span>AFTER FEES</span>
              </div>
              <div>
                <strong>{proposal.cashBridge.available}</strong>
                <span>AVAILABLE CASH</span>
              </div>
              <div>
                <strong>{proposal.cashBridge.fees}</strong>
                <span>FEES</span>
              </div>
            </div>
            <h3>Cash bridge · {proposal.target.currency}</h3>
            <p>
              {proposal.cashBridge.opening} opening + {proposal.cashBridge.sales} sales −{" "}
              {proposal.cashBridge.purchases} buys − {proposal.cashBridge.fees} fees ={" "}
              {proposal.cashBridge.closing} closing. Reserved {proposal.cashBridge.reserved} is
              unavailable for new spending.
            </p>
            <h3>Before, target and after</h3>
            <div className="chapter-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Before shares</th>
                    <th>After shares</th>
                    <th>Current</th>
                    <th>Target</th>
                    <th>After fees</th>
                    <th>Residual</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.allocations.map((a) => (
                    <tr key={a.instrumentId}>
                      <td>{a.instrumentId}</td>
                      <td>{a.beforeQuantity}</td>
                      <td>{a.afterQuantity}</td>
                      <td>{pct(a.currentWeight)}</td>
                      <td>{pct(a.targetWeight)}</td>
                      <td>{pct(a.projectedWeight)}</td>
                      <td>{pct(a.residualDrift)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Ordered proposed trades</h3>
            {proposal.trades.length === 0 && <p>No trades generated.</p>}
            {proposal.trades.map((trade, i) => (
              <article key={i}>
                <h3>
                  {i + 1}. {trade.side} {trade.instrumentId} · {trade.quantity} shares at{" "}
                  {trade.price}
                </h3>
                <p>
                  {trade.reason} Notional {trade.notional}; fee {trade.fee}.
                </p>
                {trade.lots.length > 0 && (
                  <>
                    <h4>Executable FIFO lots</h4>
                    <div className="chapter-table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Lot</th>
                            <th>Quantity</th>
                            <th>Basis removed</th>
                            <th>Gross proceeds</th>
                            <th>Gross book gain</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trade.lots.map((l) => (
                            <tr key={l.lotId}>
                              <td>{l.lotId}</td>
                              <td>{l.quantity}</td>
                              <td>{l.basisRemoved}</td>
                              <td>{l.grossProceeds}</td>
                              <td>{l.gain}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      Gain excludes separately expensed fees. Sum of independently rounded per-lot
                      proceeds may differ by cents from the single trade notional.
                    </p>
                  </>
                )}
                {trade.lotScore && (
                  <details>
                    <summary>
                      D14 illustrative lot-score comparison · {trade.lotScore.status}
                    </summary>
                    <p>{trade.lotScore.reason}</p>
                    <p>
                      Contract tier; coefficient {trade.lotScore.coefficient}. No jurisdictional tax
                      outcome and no cash effect.
                    </p>
                    <pre className="scroll-pre">{JSON.stringify(trade.lotScore, null, 2)}</pre>
                  </details>
                )}
              </article>
            ))}
            <h3>Post-fee constraints</h3>
            <div className="chapter-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Subject</th>
                    <th>Observed</th>
                    <th>Limit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.constraints.map((c, i) => (
                    <tr key={i}>
                      <td>{c.rule}</td>
                      <td>{c.subject}</td>
                      <td>{pct(c.observed ?? 0)}</td>
                      <td>{pct(c.limit ?? 0)}</td>
                      <td>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Approval rechecks prices, journal, mandate, instrument revisions and expiry. It
              creates no order.
            </p>
            <button
              className="primary"
              disabled={!canApprove || busy || proposal.status !== "ready"}
              onClick={() => void approve()}
            >
              Approve paper-trade proposal
            </button>
            {proposal.approvedAt && (
              <p role="status">
                Approved at {proposal.approvedAt}. Continue to the paper execution chapter.
              </p>
            )}
            <ul>
              {proposal.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </LearningShell>
  );
}
