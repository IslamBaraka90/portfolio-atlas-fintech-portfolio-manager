# Chapter 1 HTTP reference

Prefix: `http://127.0.0.1:3100/api/v1`. JSON requests and responses; synthetic, single-process memory mode.

## Routes

| Method | Route                     | Success | Purpose                                                      |
| ------ | ------------------------- | ------- | ------------------------------------------------------------ |
| GET    | /health                   | 200     | Process session ID and mode; compact health response         |
| GET    | /lesson                   | 200     | Public mandate and five synthetic candidate examples         |
| GET    | /mandates                 | 200     | Current mandate snapshots                                    |
| POST   | /mandates                 | 201     | Create a draft policy at revision 1                          |
| GET    | /mandates/:id             | 200     | Read current revision                                        |
| PUT    | /mandates/:id             | 200     | Save an edit with expectedRevision                           |
| GET    | /mandates/:id/revisions   | 200     | Read immutable revision snapshots                            |
| GET    | /portfolios               | 200     | List portfolios in this session                              |
| POST   | /portfolios               | 201     | Create a named portfolio bound to a mandate and its currency |
| GET    | /portfolios/:id           | 200     | Read a portfolio                                             |
| POST   | /mandates/:id/evaluations | 201     | Record an allocation decision against expectedRevision       |
| GET    | /evaluations/:id          | 200     | Read the saved allocation and result                         |
| GET    | /audit-events             | 200     | Inspect request-linked teaching audit events                 |

Every mutation requires an `Idempotency-Key` header: 8–128 letters, digits, underscores or hyphens. Keys are global to one API session. The same normalized command replays the same record; changing its input or operation returns 409.

## A complete request in PowerShell

Run the API first. These commands create a mandate, a portfolio and a recorded evaluation from the served lesson contract.

```powershell
$atlasBase = "http://127.0.0.1:3100/api/v1"
$atlasLesson = Invoke-RestMethod "$atlasBase/lesson"
$atlasMandate = Invoke-RestMethod "$atlasBase/mandates" -Method Post -ContentType "application/json" -Headers @{ "Idempotency-Key" = [guid]::NewGuid().ToString() } -Body ($atlasLesson.data.mandate | ConvertTo-Json -Depth 10)
$atlasPortfolioBody = @{ name = "PowerShell teaching portfolio"; mandateId = $atlasMandate.data.id } | ConvertTo-Json
$atlasPortfolio = Invoke-RestMethod "$atlasBase/portfolios" -Method Post -ContentType "application/json" -Headers @{ "Idempotency-Key" = [guid]::NewGuid().ToString() } -Body $atlasPortfolioBody
$atlasCurrent = Invoke-RestMethod "$atlasBase/mandates/$($atlasMandate.data.id)"
$atlasAllocation = $atlasLesson.data.scenarios[1].allocation
$atlasAllocation.asOf = $atlasCurrent.metadata.generatedAt
$atlasEvaluationBody = @{ expectedRevision = 1; allocation = $atlasAllocation } | ConvertTo-Json -Depth 10
$atlasResult = Invoke-RestMethod "$atlasBase/mandates/$($atlasMandate.data.id)/evaluations" -Method Post -ContentType "application/json" -Headers @{ "Idempotency-Key" = [guid]::NewGuid().ToString() } -Body $atlasEvaluationBody
$atlasResult.data.result
```

Expected status: `breached`; first position is 60% against a 40% cap. Nothing is traded.

## Data and errors

All non-health successes have `data`, `metadata` and `requestId`. Metadata records schemaVersion, generatedAt, synthetic mode, memory storage and sessionId. An evaluation also retains mandateRevision, policyVersion, allocation.asOf and evaluatedAt.

| HTTP status | Meaning                                                                             |
| ----------- | ----------------------------------------------------------------------------------- |
| 400         | Schema, header or malformed JSON error; field paths where available                 |
| 403         | A browser mutation came from an unapproved origin                                   |
| 404         | Route/resource absent, including records lost on restart                            |
| 409         | Stale revision, reused command key with different input, or currency already in use |
| 413 / 415   | Request too large / unsupported content type                                        |
| 500         | Unexpected failure with a safe message                                              |

A 201 evaluation response can report `satisfied`, `breached`, `invalid` or `not_evaluable`. HTTP status describes the request; the body describes the financial-policy outcome.

Error envelope: `{ error: { code, message, fields: [{ path, message }] }, requestId }`. The server generates request IDs. Audit actors are always `local-learner`; this is not authenticated identity.

The body limit is 128 KB; contracts also cap each candidate at 100 positions. The origin check and loopback binding are local teaching boundaries, not a production access-control system. Collections and the idempotency store are unpaginated and unbounded within a session.
