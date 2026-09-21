# Portfolio Atlas — Open-Source Portfolio Manager

[![Documentation checks](https://github.com/IslamBaraka90/portfolio-atlas-fintech-portfolio-manager/actions/workflows/documentation.yml/badge.svg)](https://github.com/IslamBaraka90/portfolio-atlas-fintech-portfolio-manager/actions/workflows/documentation.yml)

Build a portfolio tracker, investment analytics engine, and reporting desk with **React, TypeScript, Yahoo Finance, and fintech-algorithms**. Follow one portfolio from instrument validation and trustworthy candles through construction, paper execution, reconciliation, risk, and performance reporting.

**Current release: planning foundation.** The workspace, dependencies, architecture, and chapter PRPs are initialized. Application functions, API routes, database migrations, the Yahoo adapter, and React screens are scheduled for the chapters below; none is implemented yet.

## Start here

1. Read the [video journey](docs/video/series-blueprint.md).
2. Follow the [chapter PRPs](PRPs/README.md), starting with [Chapter 1](PRPs/01-mandate-and-universe.md).
3. Review the [architecture](docs/architecture/README.md), [data model](docs/architecture/data-model.md), and [Yahoo adapter contract](docs/architecture/yahoo-finance-adapter.md).
4. Check the [progress ledger](docs/progress.md) before continuing a chapter.
5. Read [AGENTS.md](AGENTS.md) for chapter boundaries and package lookup rules.

## Why build it this way?

Each chapter answers a question a portfolio manager actually asks: Can I trust this price? Why do I own this security? Can I afford this rebalance? What drove the return? Can I reproduce this report?

The backend exposes the financial reasoning in small domain modules. The frontend grows alongside it, showing decisions, evidence, rejected inputs, and exceptional states. A deterministic teaching portfolio makes every chapter reproducible; a separate Yahoo mode introduces real provider behavior.

## Install the foundation

Use Node 22.22 (the recorded development runtime) and npm 10 or a supported Node 24 runtime. The lockfile pins the dependency graph.

```bash
npm ci --ignore-scripts
npm run check
npm run algorithms:lookup -- show D01-F02-A01
```

The available checks validate documentation and formatting. Chapter 1 adds runnable API/web commands, TypeScript checks, and behavior tests alongside the first implementation. There is no working dashboard to launch at this stage.

## Workspace

| Location             | Responsibility                                                  |
| -------------------- | --------------------------------------------------------------- |
| `apps/api`           | Fastify HTTP boundary and application composition               |
| `apps/web`           | React + Vite portfolio desk                                     |
| `packages/contracts` | Provider-neutral API and event contracts                        |
| `packages/core`      | Financial domain, use cases, and ports                          |
| `packages/adapters`  | Yahoo Finance, fintech-algorithms, persistence, paper execution |
| `packages/testing`   | Synthetic fixtures, clocks, and future test helpers             |
| `PRPs`               | Implementation-ready chapter plans and acceptance evidence      |
| `docs`               | Architecture, decisions, teaching sequence, progress            |

## Planned capabilities

Instrument identity and eligibility; OHLCV validation; corporate actions; cash and positions; valuation and benchmarks; investment research; covariance and portfolio construction; strategy validation; rebalancing and tax-lot policies; paper orders and settlement; live risk; performance attribution; evidence-linked reports.

Specialist assets and jurisdiction-specific rules are extensions with explicit scope. Live brokerage connectivity is a future decision; the teaching course uses a paper broker.

## Learning and contribution workflow

Implement one requested chapter at a time. Commit each meaningful, verified task using:

```text
chapter-1 task-1: define mandate contracts to make portfolio constraints explicit
```

Every PRP supplies proposed task commits, backend and React outcomes, numerical checks, a video storyboard, and an end-of-chapter handoff. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Package and data sources

- [fintech-algorithms reference](https://docs.thefintechbuilder.com/reference/) and its bundled agent skill.
- [Yahoo Finance client](https://github.com/gadicc/yahoo-finance2) and its bundled agent skill.
- [The Fintech Builder](https://thefintechbuilder.com/) for the underlying learning topics.

The foundation pins fintech-algorithms 0.13.1 and yahoo-finance2 4.0.2. Portfolio construction has a [D14 release gate](docs/decisions/0003-d14-release-gate.md): the maintainer will announce when that package surface is ready.

Yahoo Finance is an unofficial, replaceable data source. Its availability and history do not establish point-in-time completeness, exchange eligibility, or market-data redistribution rights. Public fixtures are synthetic.

## License

[MIT](LICENSE) for this project's code and documentation. Upstream dependencies and provider data retain their own licenses and usage terms.
