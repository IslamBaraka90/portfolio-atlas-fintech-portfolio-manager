import { useEffect, useState } from "react";
import { z } from "zod";
import {
  governanceAuditSchema,
  approvalItemSchema,
  recoveryStatusSchema,
  recoveryCheckpointSchema,
  recoveryResultSchema,
  type GovernanceAudit,
} from "@portfolio-atlas/contracts";
import { LearningShell } from "../../app/LearningShell";
import { read, write, resetCommandKeys } from "../../shared/api";
import { useSession, refreshSession, startSession, endSession } from "../../shared/session";
import "../research/research.css";
import "./governance.css";

type Approval = z.infer<typeof approvalItemSchema>;
type Recovery = z.infer<typeof recoveryStatusSchema>;
export function GovernanceDesk() {
  const session = useSession(),
    [token, setToken] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<GovernanceAudit[]>([]),
    [inbox, setInbox] = useState<Approval[]>([]),
    [recovery, setRecovery] = useState<Recovery | null>(null),
    [selected, setSelected] = useState<Approval | null>(null),
    [evidence, setEvidence] = useState<unknown>(null),
    [reason, setReason] = useState(""),
    [ack, setAck] = useState(false),
    [filter, setFilter] = useState(""),
    [backupId, setBackupId] = useState("");
  const actor = session?.actor;
  const isApprover = session?.mode === "local_owner" || !!actor?.roles.includes("approver");
  async function refresh() {
    const [a, i, r] = await Promise.all([
      read("/governance/audit", z.array(governanceAuditSchema)),
      read("/governance/approvals", z.array(approvalItemSchema)),
      read("/governance/recovery", recoveryStatusSchema),
    ]);
    setAudit(a.data);
    setInbox(i.data);
    setRecovery(r.data);
    setBackupId((old) => old || r.data.checkpoints.at(-1)?.id || "");
  }
  useEffect(() => {
    setSelected(null);
    setEvidence(null);
    setAudit([]);
    setInbox([]);
    setRecovery(null);
    if (actor) void refresh().catch((e) => setError(String(e)));
  }, [actor?.id]);
  async function run(action: () => Promise<unknown>) {
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
  const resourcePath = (item: Approval) =>
    "/" +
    ({ report: "reports", rebalance: "rebalances", resolution: "resolutions" } as const)[
      item.kind
    ] +
    "/" +
    encodeURIComponent(item.id);
  return (
    <LearningShell active={17}>
      <div className="chapter-page research-page governance-page">
        <section className="governance-heading">
          <p className="chapter-kicker">CHAPTER 17 · GOVERNANCE & RECOVERY</p>
          <h1>Every decision has an owner.</h1>
          <p className="chapter-intro">
            Review authority, follow the evidence, and rehearse recovery before the book needs it.
          </p>
        </section>
        {error && (
          <div className="chapter-warning" role="alert">
            {error}
          </div>
        )}
        <section className="chapter-panel governance-session">
          <h2>Workspace authority</h2>
          <p>
            <strong>
              {session?.mode === "local_owner"
                ? "Local OS owner · solo teaching mode"
                : actor
                  ? "Authenticated workspace session"
                  : "Sign in to the configured workspace"}
            </strong>
          </p>
          {session?.mode === "local_owner" && (
            <p>
              This mode trusts your OS account and permits solo approval. Configure provisioned
              actors to demonstrate separation of duties.
            </p>
          )}
          {actor && (
            <p>
              Actor: {actor.name} · Roles: {actor.roles.join(", ")} · Scope:{" "}
              <code>{actor.scopeId}</code>
            </p>
          )}
          <p>
            Policy {session?.policyRevision ?? "loading"}
            {session?.expiresAt ? " · Session expires " + session.expiresAt : ""}
          </p>
          {session?.mode === "configured_sessions" && !actor && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const credential = token;
                setToken("");
                void run(async () => {
                  resetCommandKeys();
                  await startSession(credential);
                });
              }}
            >
              <label>
                Provisioned access token
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </label>
              <button disabled={busy || !token}>Start workspace session</button>
              <p>
                Run npm run auth:provision, configure AUTH_CONFIG_PATH and restart. Credentials
                remain in your private access directory.
              </p>
            </form>
          )}
          {actor && (
            <div className="governance-actions">
              <button disabled={busy} onClick={() => void run(refresh)}>
                Refresh evidence
              </button>
              {session?.mode === "configured_sessions" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      resetCommandKeys();
                      await endSession();
                    })
                  }
                >
                  End session
                </button>
              )}
            </div>
          )}
          {!session && (
            <button onClick={() => void run(refreshSession)}>Retry session status</button>
          )}
        </section>
        {actor && (
          <>
            <section className="chapter-panel">
              <h2>Approval inbox</h2>
              <p>
                Open the exact decision before approving. The server enforces role, creator
                separation and current revision.
              </p>
              {!inbox.length && <p>No drafts currently await approval.</p>}
              <div className="chapter-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Decision</th>
                      <th>Revision / creator</th>
                      <th>Authority</th>
                      <th>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inbox.map((item) => (
                      <tr key={item.kind + item.id}>
                        <td>
                          {item.kind}
                          <br />
                          <code>{item.id}</code>
                        </td>
                        <td>
                          r{item.revision}
                          <br />
                          {item.creatorId ?? "Unknown creator"}
                        </td>
                        <td>{item.reason}</td>
                        <td>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                setSelected(item);
                                setEvidence((await read(resourcePath(item), z.unknown())).data);
                                setAck(false);
                              })
                            }
                          >
                            Inspect {item.kind}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected && evidence !== null && (
                <div className="governance-review">
                  <h3>
                    Selected {selected.kind} revision {selected.revision}
                  </h3>
                  <details open>
                    <summary>Exact decision evidence</summary>
                    <pre>{JSON.stringify(evidence, null, 2)}</pre>
                  </details>
                  <label>
                    Review reason
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      minLength={10}
                    />
                  </label>
                  {selected.kind === "report" && (
                    <label className="governance-checkbox">
                      <input
                        type="checkbox"
                        checked={ack}
                        onChange={(e) => setAck(e.target.checked)}
                      />
                      I acknowledge missing sections and exceptions in this report
                    </label>
                  )}
                  <p>{selected.reason}</p>
                  <button
                    disabled={busy || !selected.canApprove || reason.trim().length < 10}
                    onClick={() =>
                      void run(async () => {
                        const payload =
                          selected.kind === "report"
                            ? {
                                expectedRevision: selected.revision,
                                actor: actor.name,
                                reason,
                                acknowledgeExceptions: ack,
                              }
                            : { expectedRevision: selected.revision, reason };
                        await write(
                          "POST",
                          resourcePath(selected) + "/approval",
                          payload,
                          z.unknown(),
                        );
                        setSelected(null);
                        setEvidence(null);
                        await refresh();
                      })
                    }
                  >
                    Approve reviewed decision
                  </button>
                  {selected.kind !== "report" && (
                    <p>
                      The decision rationale and authenticated review reason remain in the audit
                      trail.
                    </p>
                  )}
                </div>
              )}
            </section>
            <section className="chapter-panel">
              <h2>Audit explorer</h2>
              <p>
                Latest 500 events in this workspace. Committed commands and denied requests are
                distinct.
              </p>
              <label>
                Filter audit by actor, operation or resource
                <input value={filter} onChange={(e) => setFilter(e.target.value)} />
              </label>
              <div className="chapter-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>When / actor</th>
                      <th>Operation</th>
                      <th>Decision / evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit
                      .filter((v) =>
                        [v.actorId, v.operation, v.resourceId, v.requestId]
                          .join(" ")
                          .toLowerCase()
                          .includes(filter.toLowerCase()),
                      )
                      .map((v) => (
                        <tr key={v.id}>
                          <td>
                            {v.at}
                            <br />
                            {v.actorId ?? "Unauthenticated"}
                          </td>
                          <td>
                            {v.operation}
                            <br />
                            <code>
                              {v.resourceId ?? "No resource"} {v.revision ? "r" + v.revision : ""}
                            </code>
                          </td>
                          <td>
                            <strong>{v.decision}</strong>
                            <p>{v.reason}</p>
                            <small>
                              Policy {v.policyRevision} · Request {v.requestId}
                            </small>
                            {v.overrides.length > 0 && (
                              <details>
                                <summary>Override: prior and new evidence</summary>
                                <pre>{JSON.stringify(v.overrides, null, 2)}</pre>
                              </details>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="chapter-panel">
              <h2>Backup and recovery drill</h2>
              <p>
                Restore into an isolated directory. Verify file hashes, SQLite integrity, financial
                replay and every issued report revision.
              </p>
              {!recovery?.enabled ? (
                <p>
                  Recovery unavailable: this lesson uses memory storage or a custom archive. Start
                  the durable workspace to create a checkpoint.
                </p>
              ) : (
                <>
                  <label>
                    Recovery reason
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      minLength={10}
                    />
                  </label>
                  <div className="governance-actions">
                    <button
                      disabled={busy || !isApprover || reason.trim().length < 10}
                      onClick={() =>
                        void run(async () => {
                          const result = await write(
                            "POST",
                            "/governance/backups",
                            { reason },
                            recoveryCheckpointSchema,
                          );
                          setBackupId(result.data.id);
                          await refresh();
                        })
                      }
                    >
                      Create protected backup
                    </button>
                  </div>
                  <label>
                    Backup checkpoint
                    <select value={backupId} onChange={(e) => setBackupId(e.target.value)}>
                      <option value="">Choose checkpoint</option>
                      {recovery.checkpoints.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.createdAt} · {v.portfolioCount} portfolios · {v.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={busy || !isApprover || !backupId || reason.trim().length < 10}
                    onClick={() =>
                      void run(async () => {
                        await write(
                          "POST",
                          "/governance/backups/" + backupId + "/restore",
                          { reason },
                          recoveryResultSchema,
                        );
                        await refresh();
                      })
                    }
                  >
                    Verify isolated restore
                  </button>
                  {recovery.attempts.map((v) => (
                    <div className="governance-attempt" key={v.id}>
                      <h3>Restore {v.status}</h3>
                      <p>{v.reason}</p>
                      <p>
                        {v.at} · {v.actorId} · {v.portfolioCount} portfolios
                      </p>
                      {v.restoredDirectory && (
                        <p>
                          <code>{v.restoredDirectory}</code>
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}
              <p>
                Follow docs/runbooks/backup-and-recovery.md before manually selecting a verified
                restored database. Credentials are excluded from backups; financial data still needs
                OS and offline protection.
              </p>
            </section>
            <section className="chapter-panel">
              <h2>The course connects here</h2>
              <p>
                Identity → validated candles → corporate actions → book → valuation → research →
                risk → construction → validation → rebalance → paper fills → settlement → monitoring
                → performance → issued report → governed recovery.
              </p>
              <p>
                All 17 teaching chapters are available. Synthetic examples, unsupported states and
                method limitations remain visible. Public deployment and specialist assets are
                separate extensions.
              </p>
            </section>
          </>
        )}
      </div>
    </LearningShell>
  );
}
