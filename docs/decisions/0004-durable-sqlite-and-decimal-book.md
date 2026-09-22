# ADR 0004 — Durable SQLite and decimal book arithmetic

Status: accepted in Chapter 5.

The server now stores its workspace in .data/portfolio-atlas.sqlite, using the SQLite engine bundled with Node 22.22.0. node:sqlite remains an API under active development; the minimum Node 22 version is explicit. decimal.js is pinned to 10.6.0. No native npm SQLite build is required.

Migration 1 creates versioned document snapshots, portfolios, command replay records, ledger events, journal entries and journal lines. Event sequence and source reference are unique within a portfolio. Journal entries reference their events; journal lines reference their entry. Decimal amounts remain text in SQLite.

A synchronous command uses BEGIN IMMEDIATE through COMMIT, including its replay record. Async provider use cases prepare observations and archive source JSON first, then return a synchronous commit callback. A forced replay-record failure is tested to roll back the preceding state mutation. No provider request is awaited inside a write transaction.

Normal server operation is durable; test application factories and Playwright use isolated in-memory SQLite. A persistent workspace ID survives restarts. Search candidates and provider caches remain transient; saved instrument revisions and resolved-command replay remain durable. Prior chapter memory-only sessions cannot be recovered after their process ended.

A restart test rebuilds the application against the same database and evidence directory, then checks portfolios, instrument command replay, dataset revisions, action reviews and adjustment results. Archive integrity remains verified separately by SHA-256.

The schema is a teaching hybrid: flexible versioned evidence documents plus explicit relational event/journal records. It is not an ORM or a general production accounting platform. Later migrations must append a new schema version and preserve existing evidence.
