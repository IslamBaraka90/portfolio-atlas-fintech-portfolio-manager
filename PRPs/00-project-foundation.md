# PRP 00 — Project foundation and course contract

Status: complete for planning/configuration; see [progress](../docs/progress.md) for observed completion evidence.

## Outcome

Create Portfolio Atlas as an independent public GitHub repository with an educational TypeScript backend layout, React frontend layout, npm workspaces, pinned dependencies, project/data schema documentation and chapter PRPs.

## Authorized scope

Initialize configuration, dependencies, documentation, Git history and GitHub publication. Runtime implementation starts only when the maintainer requests a chapter. The Yahoo adapter is specified now and implemented in Chapters 2–3. D14 follows the maintainer's package release announcement.

## Deliverables and task commits

1. Workspaces, manifests, lockfile, ownership READMEs and contributor rules.
2. Architecture, conceptual entity/schema model, API conventions, Yahoo/algorithm adapter contracts and capability inventory.
3. PRPs for Chapters 1–8.
4. PRPs for Chapters 9–17.
5. Course index, video flow, specialist expansion plan, templates and documentation CI.
6. Publication evidence and handoff to the requested first implementation chapter.

Commit each task as chapter-0 task-N: action to purpose.

## Acceptance

- [x] The new folder has its own Git repository and does not track parent files.
- [x] npm workspaces resolve and exact dependency versions are locked.
- [x] Both required upstream agent skills are accessible through installed packages.
- [x] Installed fintech-algorithms capability is recorded; D14 is explicitly gated.
- [x] Every implementation PRP defines contracts, tasks, checks, React results, video steps and handoff.
- [x] Relative documentation links and chapter numbering are valid.
- [x] The foundation contains no application source, handlers, calculations, migrations or screens.
- [x] Formatting and Markdown checks pass.
- [x] GitHub is public under the requested personal account with a clear description and topics.
- [x] Local HEAD and published main agree; CI status is reported accurately.

## Video opener

Show the intended management questions and planned workflow diagram. If no working final dashboard exists yet, label the visual as a plan. Do not present a mockup as a functioning financial product.

The edited course opener may be re-recorded after Chapter 17 using the finished application. Keep the implementation history chronological.

## Handoff

Ask the maintainer to request Chapter 1. Do not implement Chapter 1 during this foundation task.
