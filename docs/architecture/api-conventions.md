# API conventions

Status: Chapter 1 routes implemented. See the [concrete HTTP reference](../chapters/01-http-reference.md). Later endpoint families remain proposed.

## Request context

Use /api/v1 as the initial prefix. The server generates a requestId for every request. Every Chapter 1 mutation requires an idempotency key; edits and evaluations also require the expected mandate revision. Decisions accept an explicit asOf/knowledge cutoff. The API injects clocks for recording activity rather than inventing historical availability.

## Result envelope

Use a provider-neutral result with data, status, reasons, metadata, and requestId. Metadata includes schemaVersion, asOf, generatedAt, mode, policy/model version, source/dataset references, and calculation versions as applicable. Counts state input, accepted, quarantined, unavailable, and warm-up observations.

An HTTP success does not mean data quality passed or a trade is authorized. Financial verdicts remain visible in the payload.

## Status and error handling

- 400: malformed request or schema violation.
- 404: an application resource does not exist.
- 409: conflicting revision, duplicate key with different payload, or invalid state transition.
- 422: well-formed but unsupported financial scope or missing required decision inputs.
- 429/503: provider throttling or temporary unavailability, with bounded retry semantics.
- Unexpected failures: safe message and requestId, without provider cookies, credentials, or private payloads.

Business outcomes such as ineligible instrument, rejected candle, infeasible target, or breached limit are typed reasons with evidence. Choose one consistent endpoint-specific mapping in the relevant PRP; do not catch every failure and return empty data.

## Proposed endpoint families

| Chapter | Family                                                        | Purpose                                   |
| ------- | ------------------------------------------------------------- | ----------------------------------------- |
| 1       | /mandates, /portfolios, /mandates/:id/evaluations             | Define and evaluate a mandate             |
| 2       | /instruments/search, /instruments/:id, /universe/evaluations  | Resolve identity and eligibility          |
| 3       | /market-data/ingestions, /datasets/:id, /datasets/:id/quality | Ingest and review bars                    |
| 4       | /corporate-actions, /adjustment-runs                          | Version events and histories              |
| 5       | /portfolios/:id/journal, /positions, /cash                    | Book and inspect financial state          |
| 6       | /valuations, /benchmarks                                      | Value a frozen portfolio                  |
| 7–8     | /research-runs, /risk-models                                  | Explain input evidence and risk estimates |
| 9–11    | /targets, /validation-runs, /rebalance-proposals              | Evaluate decisions before orders          |
| 12–13   | /orders, /fills, /settlements, /reconciliation-breaks         | Paper trading and operations              |
| 14–16   | /risk-findings, /performance, /reports                        | Monitor, explain, and report              |
| 17      | /audit-events, /access-policies                               | Govern evidence and access                |

A family reserves vocabulary, not every route and HTTP verb. Final endpoint schemas and examples are part of each chapter's first task.

## React contract

Use one API client boundary. Show as-of and mode labels, preserve reason codes and request IDs, and do not hide errors by replacing server output with illustrative values. Currency formatting cannot change the stored amount. Add pagination and stable sorting when a view introduces unbounded lists.

## Security progression

Early chapter APIs bind to loopback and use synthetic identities for teaching. Label that scope explicitly. The Chapter 17 access model must be complete before multi-user or public deployment. Do not deploy this planning scaffold as a financial service.
