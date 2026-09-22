# Contributing

Portfolio Atlas is taught as a sequence of Product Requirements Prompts (PRPs). Each is a bounded engineering specification containing the financial problem, contracts, tasks, validation, teaching scenes, and handoff.

## Chapter workflow

Start from `main`, select the chapter explicitly requested by the maintainer, and create a `codex/chapter-N-description` branch. Read its prerequisites and the architecture decisions. If a prerequisite is incomplete, finish only prerequisite work within the user's authorized scope or report the concrete dependency.

Complete one task at a time. Add meaningful tests when behavior is introduced. Prefer synthetic input with independently derived expected values; a test that simply repeats an implementation proves little. Run targeted checks before committing. Update the chapter evidence and progress ledger after the result is known.

Commit format: `chapter-N task-M: do X to achieve Y`. Keep each task reviewable and explain errors and financial limits. Push completed work to its branch; merge according to the user's instruction. Never manufacture passing evidence or advance to another chapter automatically.

## Current verification

Run formatting, Markdown, TypeScript, unit/API, production-build and browser checks for Chapter 1. See the [learning guide](docs/chapters/01-learning-guide.md) for commands. Planned provider and later-domain directories still contain ownership READMEs only.

## Package changes

Pin exact versions and commit the lockfile. Read installed package skills and contracts. A package upgrade is its own small commit with compatibility evidence. D14 upgrades follow the recorded release gate.

## Documentation and video

A complete chapter contains a learner question, a visible failure or decision, implementation steps, a numerical or state proof, a React walkthrough, and a handoff. Use topic names in narration; stable catalog IDs belong in notes and links. Preserve existing chapter numbering.

## Publishing

The repository is public. Commit only synthetic fixtures or material with documented redistribution permission. Review Git's staged diff before pushing. Provider requests, account data, credentials, local databases, and generated reports remain ignored.
