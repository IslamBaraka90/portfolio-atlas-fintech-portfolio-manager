# Access and incident runbook

## Configure the teaching workspace

Run `npm run auth:provision` once from the repository root. It creates random credentials for reader, analyst, operator and approver in ignored `.data/access/credentials.json`, plus SHA-256 hashes and 90-day grants in `policy.json`. The command refuses existing files. Restrict this directory to the intended Windows account using OS permissions; Node file modes do not establish Windows ACLs.

Set `AUTH_CONFIG_PATH` in the private root `.env` to the absolute policy path and restart `npm run dev`. Open **Governance & recovery**, enter one provisioned token and start a session. The token is cleared from the form and exchanged for an HttpOnly session cookie. Use a different actor to approve a restricted decision. The analyst and operator roles can be combined by the owner in the external policy when a lesson needs both.

A database binds permanently to its configured scope. Removing the configuration or changing its scope fails startup. Existing unauthenticated drafts have no configured creator evidence: make a new decision/revision under an authenticated actor. The local-owner mode remains available for a fresh solo teaching database and explicitly bypasses separation of duties.

## Policy and sessions

Every request checks grant and policy validity using half-open UTC intervals. Restart after editing policy: sessions are held in memory and disappear. To revoke an actor, remove its grant or expire it and restart. Rotate credentials by generating new random material outside Git and replacing the SHA-256 hash. Keep the policy revision meaningful; preserve prior private policy copies for incident review.

For local loopback HTTP, `AUTH_SECURE_COOKIE=false` is the development setting. HTTPS deployment must set it true; public hosting and identity-provider integration are separately scoped. Never send credentials in URLs. Browser mutations require CSRF plus allowed-origin checks; direct API clients use an Authorization bearer header and an Idempotency-Key.

## Investigate an incident

1. Stop new operations and preserve the database, WAL and immutable raw archive together. Keep credentials separately.
2. Read Governance audit by actor, request ID, operation and resource. Distinguish a denied request from a committed financial command.
3. Inspect the exact proposal, approval revision, price override reason and prior/new evidence. Acknowledgment does not clear a financial finding.
4. Revoke affected grants and restart. Take a protected backup; run an isolated restore drill before selecting a replacement database.
5. Reconcile new statements and issue superseding reports. Never rewrite issued evidence to hide an incident.

Business audit is appended in the same SQLite transaction as the mutation and replay record. HTTP denial audit records bounded reasons and route templates. Authorization/cookie headers and full request bodies are never logged by the application. User-authored financial evidence remains private workspace data: do not paste credentials into reasons or export it to a public repository.

The OS owner can alter storage. These controls demonstrate application authority and recovery; they do not claim remote immutable audit, multi-tenant hosting, MFA or a security certification.
