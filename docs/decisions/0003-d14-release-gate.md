# ADR 0003 — D14 portfolio construction release gate

Status: release announced and 0.13.2 installed on 2026-09-22; method-specific acceptance remains required.

The foundation pins fintech-algorithms 0.13.1. The user's local catalog contains D14 material, but this repository must use an explicitly verified npm release. Chapter 9 depends on that checkpoint. Chapters 1–8 can proceed without it.

## When the maintainer announces availability

1. Inspect npm's published version and release notes.
2. Upgrade the exact version in the adapters workspace and lockfile.
3. Read the installed docs.json, package exports, declarations, skill, examples, and verification tiers.
4. Resolve every required D14 topic by stable ID and document its actual import/signature/output contract.
5. Execute the documented examples and compatibility checks for already-used algorithms.
6. Update the integration inventory and this decision with the tested version and any unavailable topics.
7. Commit the dependency change separately before implementing the optimizer chapter.

Suggested commit: `chapter-9 task-0: adopt verified D14 exports to enable portfolio construction`.

If an intended method is absent, record it as unavailable and use only methods the maintainer agrees are in scope. Do not create plausible import paths, link privately to sibling code, or silently swap optimizer definitions.

Chapter 9 may describe all D14 families for learning, but implemented algorithms must be limited to verified release capabilities and explicit product scope.

## Release adoption

The user expanded authorization to the full 17-chapter build. npm confirms 0.13.2, and the installed docs payload contains 717 topics including 20 D14 methods, all at contract tier. The installed skill, exports, declarations and captured examples were inspected. Static skill tier totals lag behind the payload; use dependency-capabilities.json.

The release smoke test exercises globalMinimumVariance and inverseVolatilityWeights using independently derived two-asset optima, and rejects an indefinite covariance matrix. Existing adapter regressions check candle validation, identity, corporate-action and basis-drift compatibility. Chapter 9 records each additional method before importing it. An installed optimizer is not an executable trade proposal.
