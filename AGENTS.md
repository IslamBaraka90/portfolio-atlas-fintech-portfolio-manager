# Working on Portfolio Atlas

## Current phase and authorization

Current authorization (2026-09-22): complete all Chapters 1–17 autonomously, with verified task commits and GitHub publication. The user announced fintech-algorithms 0.13.2 and revoked the D14 stopping point. Read docs/progress.md and each PRP before implementation; complete chapter gates, publish its checkpoint, and continue to the next chapter. This explicit instruction supersedes older per-chapter handoff and D14-wait text in historical plans.

Do not modify the parent edufintech project or sibling repositories. Run Git inside this repository. Do not commit credentials, provider caches, generated reports containing private holdings, or unrelated changes.

## Architecture

React calls the API. HTTP handlers call core use cases through composition. The core defines ports; adapters implement provider, analytics, storage, and paper-broker integrations. Vendor payloads and names stay in adapters. See `docs/architecture/README.md`.

Use TypeScript with strict configuration. Explain financial invariants beside the code that enforces them. Avoid generic service layers that obscure the chapter's financial purpose.

## Required package discovery

After `npm ci --ignore-scripts`, read:

- `node_modules/fintech-algorithms/skills/fintech-algorithms/SKILL.md`;
- its `references/ingestion.md` and `references/pitfalls.md` when wiring data;
- `node_modules/yahoo-finance2/skills/yahoo-finance2/SKILL.md` when touching Yahoo.

These are version-matched upstream skills installed by the pinned dependencies. Follow their consumer guidance, not repository-maintainer commands for editing upstream packages. If npm changes hoisting, locate the package under the adapters workspace. Do not substitute a global skill's older contract.

Run `npm run algorithms:lookup -- show <topic-id-or-slug>` before naming imports or returned fields. Installed `docs.json`, declarations, exports, and captured examples own the installed API. Website references can be ahead. Record verification tiers accurately; shared-fixture parity is not independent validation.

The pinned Yahoo major is v4. Use its class-based API and installed declarations; some upstream skill prose still refers to v3. Do not use a deprecated singleton API or put the Yahoo client in React.

## D14 checkpoint

The user announced D14 in 0.13.2. Follow `docs/decisions/0003-d14-release-gate.md` at that time. Do not guess exports, use a sibling repository as a hidden dependency, or implement an optimizer substitute just to bypass the gate. Earlier chapters can proceed.

## Financial contracts

Preserve permanent IDs, market and knowledge times, currencies, units, adjustment basis, null reasons, and dataset lineage. Never fill missing observations with zero or silently compress time. Book adjustments, market data adjustments, valuation, and performance are distinct operations. Monetary accounting needs explicit decimal/rounding rules; number arrays supplied to algorithms need a documented conversion boundary.

Teaching defaults: deterministic synthetic data, daily bars, long-only cash-funded positions, and paper execution. Specialist assets and jurisdictional policies must be explicitly enabled. Live Yahoo history is not point-in-time evidence.

## Commit and validation protocol

1. Read the PRP and dependencies; record any scope decision.
2. Implement a small task and its meaningful checks.
3. Inspect `git diff` and commit only intended files.
4. Use `chapter-N task-M: do X to achieve Y`.
5. Keep task commits small enough for a viewer to replay.
6. Update `docs/progress.md` with actual commands, results, limitations, and commit references.
7. Run chapter gates, publish the verified checkpoint, and continue through Chapter 17.

Use `codex/chapter-N-description` for future implementation branches. Do not reset the user's changes. Do not claim a backend, UI, or financial test ran when only documentation checks exist.
