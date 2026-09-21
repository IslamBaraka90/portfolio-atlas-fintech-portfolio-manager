# ADR 0003 — D14 portfolio construction release gate

Status: waiting for the maintainer's package-release announcement.

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
