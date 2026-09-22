# Chapter PRP index

A **Product Requirements Prompt** is the implementation contract for a chapter: problem, scope, inputs and outputs, backend and React work, meaningful validation, task commits, video walkthrough, and next boundary.

Current stage: Chapters 1–6 implemented; Chapter 7 is next. All remaining chapters through 17 are now authorized. D14 ships in the pinned 0.13.2 release. See the [progress ledger](../docs/progress.md).

| Chapter | Build outcome                                               | Plan                                          |
| ------- | ----------------------------------------------------------- | --------------------------------------------- |
| 0       | Repository, schema blueprint, dependencies and course plans | [Foundation](00-project-foundation.md)        |
| 1       | Mandate and investable universe                             | [PRP 01](01-mandate-and-universe.md)          |
| 2       | Instrument identity and eligibility                         | [PRP 02](02-instrument-identity.md)           |
| 3       | Market data ingestion and candle validation                 | [PRP 03](03-market-data-validation.md)        |
| 4       | Corporate actions, adjustment basis and FX                  | [PRP 04](04-corporate-actions-and-fx.md)      |
| 5       | Cash, positions, tax lots and the book of record            | [PRP 05](05-portfolio-accounting.md)          |
| 6       | Valuation, NAV and an honest benchmark                      | [PRP 06](06-valuation-and-benchmarks.md)      |
| 7       | Research signals, fundamentals and evidence                 | [PRP 07](07-research-and-insights.md)         |
| 8       | Expected returns, covariance and risk inputs                | [PRP 08](08-risk-model-and-forecasts.md)      |
| 9       | Portfolio construction and practical constraints            | [PRP 09](09-portfolio-construction.md)        |
| 10      | Time-aware backtesting and decision validation              | [PRP 10](10-strategy-validation.md)           |
| 11      | Rebalancing, cash flows and tax-lot policies                | [PRP 11](11-rebalancing-and-tax-lots.md)      |
| 12      | Pre-trade controls and paper execution                      | [PRP 12](12-orders-and-paper-execution.md)    |
| 13      | Settlement, custody and reconciliation                      | [PRP 13](13-settlement-and-reconciliation.md) |
| 14      | Portfolio risk monitoring and actionable alerts             | [PRP 14](14-risk-and-alerts.md)               |
| 15      | Performance measurement and attribution                     | [PRP 15](15-performance-and-attribution.md)   |
| 16      | Management insights and the reporting desk                  | [PRP 16](16-insights-and-reporting.md)        |
| 17      | Governance, access and recovery                             | [PRP 17](17-governance-and-recovery.md)       |

## Execution rules

The maintainer authorized continuous implementation through Chapter 17. Read [AGENTS.md](../AGENTS.md), [progress](../docs/progress.md) and the PRP. Implement its meaningful tasks, validate each task, commit frequently, record evidence, publish the chapter checkpoint, and continue.

A dependency being installed, a directory existing, or a topic being named never marks a feature complete. Some application capabilities rely on catalog topics that are not yet npm exports.

Chapter 9 uses the verified [D14 package gate](../docs/decisions/0003-d14-release-gate.md). Earlier chapters can proceed. Package availability and API contracts are checked again when each chapter begins.

## Course support

- [Video sequence and narrative](../docs/video/series-blueprint.md)
- [Recording worksheet](../docs/video/chapter-recording-template.md)
- [Chapter evidence template](../docs/video/chapter-evidence-template.md)
- [New PRP template](TEMPLATE.md)
- [Specialist expansion PRP](extensions.md)
- [Full-domain curriculum map](../docs/curriculum-map.md)

## Start request

```text
Start Chapter 1 of Portfolio Atlas using PRPs/01-mandate-and-universe.md.
Build its backend and React outcomes, verify each task, commit frequently,
and stop at the chapter handoff.
```
