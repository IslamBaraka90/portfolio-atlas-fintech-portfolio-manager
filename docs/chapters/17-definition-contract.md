# Chapter 17 — authority and recovery contract

## Deployment and trust boundary

The teaching server remains loopback-only. Default local-owner mode trusts the OS user, labels that authority and bypasses separation of duties for solo lessons. Configured-session mode requires provisioned high-entropy bearer credentials or a short-lived browser session. No shipped credentials. Public deployment, identity-provider federation, MFA and tenant hosting need separate work.

One database is one workspace scope, bound persistently when configured access is enabled. Every financial read and write requires a current grant in that scope. A different scope is denied before resource lookup. This is not row-level multi-tenant storage.

## Authority

| Role     | Actions                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| reader   | Read workspace evidence and audit                                                                                       |
| analyst  | Mandates, evaluations, valuation without overrides, research, risk, construction, proposals, performance, report drafts |
| operator | Identity/data ingestion, book postings, paper execution, settlement, statements/reconciliation and resolution proposals |
| approver | Restricted approvals, risk resolution, valuation overrides, ledger corrections, recovery                                |

Roles may combine. Configured actors cannot approve their own rebalance, resolution or report revision. Missing creator evidence fails closed. Server-authenticated identity owns audit and replaces submitted actor labels. Policy and actor grants use half-open UTC effective intervals. Configuration reload requires restart, which invalidates browser sessions. Requests and command commits recheck authority.

Unknown mutation routes are denied. Safe reads require authentication; health and session status expose only operational/public identity information. Command keys are actor/scope namespaced; successful command evidence and actor audit share the financial transaction. Replays never duplicate audit. Denial events retain route template, request correlation, decision and policy, without credential or request-body logging.

## Sessions and overrides

Browser exchange uses an Authorization header; random sessions expire after 30 minutes, use HttpOnly, SameSite=Strict and a path restricted to the API. Secure cookies are enabled for HTTPS; local HTTP has an explicit development setting. Unsafe cookie requests need a session CSRF header and the existing allowed-origin check. Tokens never go in URLs or browser storage. Session and API responses are no-store.

Price overrides require approver authority, a reason and source evidence. Audit freezes the previous recorded mark (or explicit absence), new override terms, authenticated actor and policy revision. This is a reviewable manual mark, not provider certification.

## Recovery

A synchronous SQLite VACUUM INTO creates a consistent new database in an application-generated UUID directory. A manifest hashes the database and immutable raw evidence, includes deterministic replay summaries and a logical document digest covering every report revision. A checkpoint is recorded only after the files and manifest exist.

Restore verifies the registered manifest hash, each file hash, SQLite integrity/foreign keys, ledger replay and logical snapshot digest in a new isolated directory. It never overwrites the running database. Cash, quantities, lots, obligations, journal checks and frozen references must match; generated timestamps are excluded from replay comparison. Corruption remains a failed recovery attempt. Credentials are external and excluded. Recovery metadata itself is recorded after the backup cutoff.

The OS owner controls database and files. Hashes detect accidental or unauthorized file changes relative to the trusted checkpoint; they are not remote tamper-proof attestation. Backups contain financial data and require OS access controls and offline protection. Memory-mode lessons explicitly cannot back up durable evidence.

## Primary sources

The application maps least privilege, default denial and per-request authorization from [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html). Session handling follows [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). Backup semantics follow [SQLite VACUUM INTO](https://www.sqlite.org/lang_vacuum.html). These references guide this bounded implementation; they are not a security certification.
