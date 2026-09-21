# ADR 0002 — Reproducible data and progressive storage

Status: accepted for the teaching course.

Synthetic mode drives demos and default tests. Yahoo mode is an explicit provider option introduced in Chapters 2–3. Never silently switch between them. Provider response caches and account data stay outside Git.

Chapter 1 uses an in-memory repository with a visible session-only limitation. Chapter 5 introduces durable SQLite storage, explicit transactions, schema migrations, immutable journal events, and restart/replay tests. The storage driver is chosen when implementation begins.

The course starts with equities, ETFs, cash, daily bars, and paper execution. Direct fixed-income instruments, derivatives, crypto custody, live brokerage, and jurisdictional tax claims are specialist scope.

Tradeoff: live observations improve realism but do not reproduce a historical information set. Backtests must carry a dataset suitability verdict and cannot call today's Yahoo fundamentals point-in-time history.
