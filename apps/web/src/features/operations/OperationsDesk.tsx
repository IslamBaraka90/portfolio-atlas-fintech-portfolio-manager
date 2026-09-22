import { useEffect, useState } from "react";
import { z } from "zod";
import {
  bookSnapshotSchema,
  bookStateSchema,
  settlementPolicySchema,
  statementSnapshotSchema,
  statementInputSchema,
  reconciliationRunSchema,
  resolutionSchema,
  type ReconciliationRun,
  type Resolution,
  type StatementSnapshot,
  type SettlementPolicy,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write } from "../../shared/api";
import "../research/research.css";
import "../valuation/valuation.css";
const queueSchema = z.array(
  z.object({ portfolioId: z.string(), portfolioName: z.string(), book: bookSnapshotSchema }),
);
type Queue = z.infer<typeof queueSchema>;
export function OperationsDesk() {
  const [queue, setQueue] = useState<Queue>([]),
    [policies, setPolicies] = useState<SettlementPolicy[]>([]),
    [statements, setStatements] = useState<StatementSnapshot[]>([]),
    [runs, setRuns] = useState<ReconciliationRun[]>([]),
    [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [portfolioId, setPortfolioId] = useState(""),
    [obligationId, setObligationId] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [sourceRef, setSourceRef] = useState(""),
    [reason, setReason] = useState(""),
    [owner, setOwner] = useState("Teaching operator"),
    [statementId, setStatementId] = useState(""),
    [runId, setRunId] = useState(""),
    [breakId, setBreakId] = useState(""),
    [evidence, setEvidence] = useState(""),
    [correction, setCorrection] = useState(""),
    [batchRefs, setBatchRefs] = useState("[]");
  const [statementText, setStatementText] = useState(""),
    [lag, setLag] = useState("0"),
    [holidays, setHolidays] = useState(""),
    [weekdays, setWeekdays] = useState("1,2,3,4,5"),
    [calendarName, setCalendarName] = useState("Authored UTC teaching calendar"),
    [from, setFrom] = useState(new Date().toISOString().slice(0, 10)),
    [to, setTo] = useState(new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function refresh() {
    const [q, p, s, r, v] = await Promise.all([
      read("/settlement-queue", queueSchema),
      read("/settlement-policies", z.array(settlementPolicySchema)),
      read("/statements", z.array(statementSnapshotSchema)),
      read("/reconciliations", z.array(reconciliationRunSchema)),
      read("/resolutions", z.array(resolutionSchema)),
    ]);
    setQueue(q.data);
    setPolicies(p.data);
    setStatements(s.data);
    setRuns(r.data);
    setResolutions(v.data);
  }
  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
  }, []);
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  const selected = queue.find((q) => q.portfolioId === portfolioId),
    obligation = selected?.book.settlements.find((s) => s.id === obligationId),
    run = runs.find((r) => r.id === runId);
  function template() {
    setStatementText(
      JSON.stringify(
        {
          portfolioId,
          asOf: new Date().toISOString(),
          sourceRef: "authored-custody-statement",
          source: "synthetic_custodian_statement",
          trades: [],
          positions: [],
          cash: [],
          actions: [],
        },
        null,
        2,
      ),
    );
  }
  return (
    <LearningShell active={13}>
      <div className="chapter-page research-page">
        <div className="chapter-kicker">CHAPTER 13 · SETTLEMENT & RECONCILIATION</div>
        <h1>Prove the records agree.</h1>
        <p className="chapter-intro">
          Trade-date exposure, custody delivery and spendable cash answer different questions. Keep
          each source and every correction.
        </p>
        {error && (
          <div role="alert" className="chapter-warning">
            {error}
          </div>
        )}
        <section className="chapter-panel">
          <h2>Calendar policy</h2>
          <p>
            Author an explicit UTC calendar before choosing it on the Paper execution desk. Zero lag
            still needs a custody acknowledgment.
          </p>
          <div className="chapter-form">
            <label>
              Calendar name
              <input value={calendarName} onChange={(e) => setCalendarName(e.target.value)} />
            </label>
            <label>
              Business-day lag
              <input
                type="number"
                min="0"
                max="5"
                value={lag}
                onChange={(e) => setLag(e.target.value)}
              />
            </label>
            <label>
              Coverage from
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Coverage to
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label>
              UTC business weekdays (0 Sunday to 6 Saturday)
              <input value={weekdays} onChange={(e) => setWeekdays(e.target.value)} />
            </label>
            <label>
              Holidays (comma-separated dates)
              <input value={holidays} onChange={(e) => setHolidays(e.target.value)} />
            </label>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await write(
                    "POST",
                    "/settlement-policies",
                    {
                      name: calendarName,
                      lagBusinessDays: Number(lag),
                      from,
                      to,
                      businessWeekdays: weekdays.split(",").map((s) => Number(s.trim())),
                      holidays: holidays
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                    settlementPolicySchema,
                  );
                })
              }
            >
              Save calendar
            </button>
          </div>
          <ul>
            {policies.map((p) => (
              <li key={p.id}>
                {p.name}: {p.lagBusinessDays} business days · {p.from}–{p.to} · holidays:{" "}
                {p.holidays.join(", ") || "none"} · UTC weekdays {p.businessWeekdays.join(", ")}
              </li>
            ))}
          </ul>
        </section>
        <section className="chapter-panel">
          <h2>Custody queue</h2>
          <label>
            Operations portfolio
            <select
              value={portfolioId}
              onChange={(e) => {
                setPortfolioId(e.target.value);
                setObligationId("");
              }}
            >
              <option value="">Select portfolio</option>
              {queue.map((q) => (
                <option key={q.portfolioId} value={q.portfolioId}>
                  {q.portfolioName}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary" disabled={busy} onClick={() => void act(refresh)}>
            Reload operations
          </button>
          {selected && (
            <>
              <div className="chapter-table-wrap">
                <table>
                  <caption>Settled cash and trade-date economics</caption>
                  <thead>
                    <tr>
                      <th>Currency</th>
                      <th>Settled</th>
                      <th>Pending net</th>
                      <th>Economic</th>
                      <th>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.book.cash.map((c) => (
                      <tr key={c.currency}>
                        <td>{c.currency}</td>
                        <td>{c.settled}</td>
                        <td>{c.pending}</td>
                        <td>{c.economic ?? c.settled}</td>
                        <td>{c.available}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chapter-table-wrap">
                <table>
                  <caption>Settlement obligations</caption>
                  <thead>
                    <tr>
                      <th>Trade / side</th>
                      <th>Due / aging</th>
                      <th>Remaining shares / cash</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.book.settlements.map((s) => (
                      <tr key={s.id}>
                        <td>
                          {s.instrumentId} · {s.side}
                        </td>
                        <td>
                          {s.dueDate} ·{" "}
                          {s.status === "settled"
                            ? "closed"
                            : Math.max(
                                0,
                                Math.floor(
                                  (Date.parse(new Date().toISOString().slice(0, 10)) -
                                    Date.parse(s.dueDate)) /
                                    86400000,
                                ),
                              )}{" "}
                          {s.status !== "settled" && "days past due"}
                        </td>
                        <td>
                          {s.remainingQuantity} / {s.currency} {s.remainingCash}
                        </td>
                        <td>
                          {s.status} {s.failureReason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chapter-form">
                <label>
                  Pending obligation
                  <select value={obligationId} onChange={(e) => setObligationId(e.target.value)}>
                    <option value="">Select obligation</option>
                    {selected.book.settlements
                      .filter((s) => s.status !== "settled")
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.instrumentId} · {s.side} · {s.remainingQuantity}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Delivered shares
                  <input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </label>
                <label>
                  Custody event reference
                  <input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
                </label>
                <label>
                  Operations reason
                  <input value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
                {(["settle", "fail"] as const).map((kind) => (
                  <button
                    key={kind}
                    className="secondary"
                    disabled={busy || !obligation}
                    onClick={() =>
                      void act(async () => {
                        await write(
                          "POST",
                          "/settlement-events",
                          {
                            portfolioId,
                            settlementId: obligationId,
                            expectedCheckpoint: selected.book.checkpoint,
                            kind,
                            quantity: kind === "settle" ? quantity : null,
                            sourceRef,
                            reason,
                          },
                          bookStateSchema,
                        );
                      })
                    }
                  >
                    {kind === "settle" ? "Acknowledge delivery" : "Record delivery failure"}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
        <section className="chapter-panel">
          <h2>Independent statement</h2>
          <p>
            Enter independently authored custody balances. Omitted balances mean zero. Importing a
            statement never edits the book. Reusing its source reference creates a new immutable
            revision.
          </p>
          <button className="secondary" disabled={!portfolioId || busy} onClick={template}>
            Prepare empty statement
          </button>
          <label>
            Statement JSON
            <textarea
              rows={14}
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !statementText}
            onClick={() =>
              void act(async () => {
                const s = (
                  await write(
                    "POST",
                    "/statements",
                    statementInputSchema.parse(JSON.parse(statementText)),
                    statementSnapshotSchema,
                  )
                ).data;
                setStatementId(s.id);
              })
            }
          >
            Import synthetic statement
          </button>
          <div className="chapter-form">
            <label>
              Statement revision
              <select value={statementId} onChange={(e) => setStatementId(e.target.value)}>
                <option value="">Select latest revision</option>
                {statements.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sourceRef} · r{s.revision}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Paper batch references JSON
              <textarea
                rows={3}
                value={batchRefs}
                onChange={(e) => setBatchRefs(e.target.value)}
                placeholder='[{"id":"batch-id","revision":1}]'
              />
            </label>
            <button
              className="primary"
              disabled={busy || !statementId}
              onClick={() =>
                void act(async () => {
                  const s = statements.find((s) => s.id === statementId)!,
                    q = queue.find((q) => q.portfolioId === s.portfolioId)!;
                  const r = (
                    await write(
                      "POST",
                      "/reconciliations",
                      {
                        statement: { id: s.id, revision: s.revision },
                        checkpoint: q.book.checkpoint,
                        batches: JSON.parse(batchRefs),
                      },
                      reconciliationRunSchema,
                    )
                  ).data;
                  setRunId(r.id);
                  setBreakId("");
                })
              }
            >
              Reconcile statement
            </button>
          </div>
        </section>
        <section className="chapter-panel">
          <h2>Breaks and resolutions</h2>
          <label>
            Saved reconciliation
            <select
              value={runId}
              onChange={(e) => {
                setRunId(e.target.value);
                setBreakId("");
              }}
            >
              <option value="">Select run</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.statement.sourceRef} r{r.statement.revision} · {r.status} · {r.createdAt}
                </option>
              ))}
            </select>
          </label>
          {run && (
            <div data-testid="reconciliation-result">
              <h3>Reconciliation: {run.status}</h3>
              <p>
                Book checkpoint {run.book.book.checkpoint}; statement r{run.statement.revision};{" "}
                {run.matchedFillIds.length} exact fill matches.
              </p>
              <div className="chapter-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Category / subject</th>
                      <th>Book evidence</th>
                      <th>Statement evidence</th>
                      <th>Reason / candidates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.breaks.map((b) => (
                      <tr key={b.id}>
                        <td>
                          {b.category} · {b.subject}
                        </td>
                        <td>{b.expected ?? "missing"}</td>
                        <td>{b.observed ?? "missing"}</td>
                        <td>
                          {b.reason} {b.candidateIds.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul>
                {run.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <div className="chapter-form">
                <label>
                  Break to resolve
                  <select value={breakId} onChange={(e) => setBreakId(e.target.value)}>
                    <option value="">Select break</option>
                    {run.breaks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.category} · {b.subject}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Resolution owner
                  <input value={owner} onChange={(e) => setOwner(e.target.value)} />
                </label>
                <label>
                  Evidence reference
                  <input value={evidence} onChange={(e) => setEvidence(e.target.value)} />
                </label>
                <label>
                  Resolution reason
                  <input value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
              </div>
              <details>
                <summary>Optional latest-event reverse/repost</summary>
                <p>
                  Paste a correction request with portfolioId, originalEventId, reason and
                  replacement (or null). Only latest cash or settlement events are supported.
                  Approval checks the frozen book checkpoint and posts the reversal atomically.
                </p>
                <label>
                  Correction JSON
                  <textarea
                    rows={6}
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                  />
                </label>
              </details>
              <button
                className="primary"
                disabled={busy || !breakId}
                onClick={() =>
                  void act(async () => {
                    await write(
                      "POST",
                      "/resolutions",
                      {
                        runId,
                        breakId,
                        owner,
                        reason,
                        evidenceRef: evidence,
                        correction: correction.trim() ? JSON.parse(correction) : null,
                      },
                      resolutionSchema,
                    );
                  })
                }
              >
                Propose resolution
              </button>
            </div>
          )}
          <ul>
            {resolutions
              .filter((r) => !runId || r.request.runId === runId)
              .map((r) => (
                <li key={r.id}>
                  <strong>{r.status}</strong> · {r.request.owner} · {r.request.reason} · evidence{" "}
                  {r.request.evidenceRef} · journal{" "}
                  {r.journalEventIds.join(", ") || "no correction"}{" "}
                  {r.status === "proposed" && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await write(
                            "POST",
                            "/resolutions/" + r.id + "/approval",
                            { expectedRevision: r.revision },
                            resolutionSchema,
                          );
                        })
                      }
                    >
                      Approve resolution
                    </button>
                  )}
                </li>
              ))}
          </ul>
          <p>
            Approval records responsibility. Original breaks remain visible; run reconciliation
            again after correction or custody delivery.
          </p>
        </section>
      </div>
    </LearningShell>
  );
}
