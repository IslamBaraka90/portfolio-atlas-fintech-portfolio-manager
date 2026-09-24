# Portfolio Atlas — Open-Source Portfolio Manager

[![Chapter checks](https://github.com/IslamBaraka90/portfolio-atlas-fintech-portfolio-manager/actions/workflows/documentation.yml/badge.svg)](https://github.com/IslamBaraka90/portfolio-atlas-fintech-portfolio-manager/actions/workflows/documentation.yml)

Build a portfolio tracker, investment analytics engine, and reporting desk with **React, TypeScript, Yahoo Finance, and fintech-algorithms**. Follow one portfolio from instrument validation and trustworthy candles through construction, paper execution, reconciliation, risk, and performance reporting.

**Chapters 1–17 are implemented.** The React desk connects validated market data, a decimal accounting book, D14 portfolio construction, paper execution, custody reconciliation, risk, cash-flow-aware performance, immutable reports and governed recovery. The backend uses fintech-algorithms **0.13.2** and Yahoo Finance v4 through adapters. Follow the chronological task commits and chapter learning guides.

The complete course branch is \`codex/chapter-17-governance-recovery\`. Chapters are published as stacked pull requests; review them in order. Public deployment and specialist assets remain separate extensions.

## Start here

1. Read the [video journey](docs/video/series-blueprint.md) and [recorded commit map](docs/video/implemented-checkpoints.md).
2. Follow the [chapter PRPs](PRPs/README.md), starting with [Chapter 1](PRPs/01-mandate-and-universe.md).
3. Review the [architecture](docs/architecture/README.md), [data model](docs/architecture/data-model.md), and [Yahoo adapter contract](docs/architecture/yahoo-finance-adapter.md).
4. Check the [progress ledger](docs/progress.md) before continuing a chapter.
5. Read [AGENTS.md](AGENTS.md) for chapter boundaries and package lookup rules.

## Why build it this way?

Each chapter answers a question a portfolio manager actually asks: Can I trust this price? Why do I own this security? Can I afford this rebalance? What drove the return? Can I reproduce this report?

The backend exposes the financial reasoning in small domain modules. The frontend grows alongside it, showing decisions, evidence, rejected inputs, and exceptional states. A deterministic teaching portfolio makes every chapter reproducible; a separate Yahoo mode introduces real provider behavior.

## Run the learning desk

Use Node 22.22 (the recorded development runtime) and npm 10 or a supported Node 24 runtime. The lockfile pins the dependency graph.

```bash
npm ci --ignore-scripts
npm run dev
```

For the complete published build, first run \`git switch codex/chapter-17-governance-recovery\` (after fetching the branch). Open <http://127.0.0.1:5173>. Create the sample portfolio, choose **Concentrated**, then **Check allocation** to see a 60% holding breach a 40% cap. Teaching defaults are synthetic. Chapter 5 introduces durable SQLite storage under .data/portfolio-atlas.sqlite; saved workspace records survive API restarts. Most browser fixtures use memory SQLite; the governance journey runs its own temporary durable workspace.

Follow the [Chapter 1 learning guide](docs/chapters/01-learning-guide.md) for the code-reading order, complete walkthrough and chronological commit map. See the [HTTP reference](docs/chapters/01-http-reference.md) and [recording notes](docs/video/chapter-01-recording-notes.md).

```bash
npm run check
npm run typecheck
npm run test:unit
npm run build
npx playwright install chromium
npm run test:browser
```

CI runs the same checks on Node 22.22.0. Browser tests use ports 3101 and 5174; normal development uses 3100 and 5173.

See the [Chapter 2 guide](docs/chapters/02-learning-guide.md) for instrument discovery, live Yahoo setup and the recorded provider smoke check.

## Design system

The desk uses **The Fintech Builder Open Core 03.1** design system: registry tokens generated into CSS variables, the official Open Core mark, light and dark themes, 16 px body and 44 px targets. See [apps/web/src/design-system](apps/web/src/design-system/README.md). `npm run check` verifies the generated tokens.

## Governance and recovery

The default loopback app uses a clearly labeled local OS owner for solo lessons. Run \`npm run auth:provision\`, configure private AUTH_CONFIG_PATH and restart to use reader, analyst, operator and approver sessions with separation of duties. See the [access runbook](docs/runbooks/access-and-incidents.md).

The governance desk creates protected checkpoints and verifies real restores into a separate directory. Hashes, SQLite integrity, ledger replay and every frozen report revision must match. See the [recovery runbook](docs/runbooks/backup-and-recovery.md).

## Chapter learning guides

| Chapters | Follow the evidence                                                                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1–4      | [Mandate](docs/chapters/01-learning-guide.md), [identity](docs/chapters/02-learning-guide.md), [candles](docs/chapters/03-learning-guide.md), [actions and FX](docs/chapters/04-learning-guide.md)                                                     |
| 5–8      | [Book](docs/chapters/05-learning-guide.md), [valuation](docs/chapters/06-learning-guide.md), [research](docs/chapters/07-learning-guide.md), [risk inputs](docs/chapters/08-learning-guide.md)                                                         |
| 9–12     | [Construction](docs/chapters/09-learning-guide.md), [causal validation](docs/chapters/10-learning-guide.md), [rebalance](docs/chapters/11-learning-guide.md), [paper execution](docs/chapters/12-learning-guide.md)                                    |
| 13–17    | [Settlement](docs/chapters/13-learning-guide.md), [monitoring](docs/chapters/14-learning-guide.md), [performance](docs/chapters/15-learning-guide.md), [reports](docs/chapters/16-learning-guide.md), [governance](docs/chapters/17-learning-guide.md) |

## Workspace

| Location             | Responsibility                                                  |
| -------------------- | --------------------------------------------------------------- |
| `apps/api`           | Fastify HTTP boundary and application composition               |
| `apps/web`           | React + Vite portfolio desk                                     |
| `packages/contracts` | Provider-neutral API and event contracts                        |
| `packages/core`      | Financial domain, use cases, and ports                          |
| `packages/adapters`  | Yahoo Finance, fintech-algorithms, persistence, paper execution |
| `packages/testing`   | Synthetic fixtures, clocks, and replay helpers                  |
| `PRPs`               | Implementation-ready chapter plans and acceptance evidence      |
| `docs`               | Architecture, decisions, teaching sequence, progress            |

## Implemented teaching capabilities

Instrument identity and eligibility; OHLCV validation; corporate actions; cash and positions; valuation and benchmarks; investment research; covariance and portfolio construction; strategy validation; rebalancing and tax-lot policies; paper orders and settlement; portfolio risk monitoring; performance attribution; evidence-linked reports.

Specialist assets and jurisdiction-specific rules are extensions with explicit scope. Live brokerage connectivity is a future decision; the teaching course uses a paper broker.

## Learning and contribution workflow

Replay one chapter at a time. Each meaningful task has a chronological commit using:

```text
chapter-1 task-1: define mandate contracts to make portfolio constraints explicit
```

Every PRP supplies proposed task commits, backend and React outcomes, numerical checks, a video storyboard, and an end-of-chapter handoff. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Package and data sources

- [fintech-algorithms reference](https://docs.thefintechbuilder.com/reference/) and its bundled agent skill.
- [Yahoo Finance client](https://github.com/gadicc/yahoo-finance2) and its bundled agent skill.
- [The Fintech Builder](https://thefintechbuilder.com/) for the underlying learning topics.

The app pins fintech-algorithms 0.13.2 and yahoo-finance2 4.0.2. D14 is published with 20 contract-tier methods; see the [release adoption evidence](docs/decisions/0003-d14-release-gate.md).

Yahoo Finance is an unofficial, replaceable data source. Its availability and history do not establish point-in-time completeness, exchange eligibility, or market-data redistribution rights. Public fixtures are synthetic.

## License

[MIT](LICENSE) for this project's code and documentation. Upstream dependencies and provider data retain their own licenses and usage terms.

The [Chapter 3 candle-quality guide](docs/chapters/03-learning-guide.md) connects raw evidence, validation, immutable datasets and the React quality desk.

The [Chapter 4 guide](docs/chapters/04-learning-guide.md) explains separate source, split, dividend and constant-FX research views with action revision evidence.
