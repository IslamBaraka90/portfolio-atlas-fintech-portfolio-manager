# Chapter 7 — Explain what was known

## Teach the two clocks

A statement period ending December 2025 was released in March 2026 in the authored lesson. Its September correction was not available in April. Yahoo statements fetched today have observation time only; period end is not publication evidence.

Start with [the definition contract](07-definition-contract.md). It records exact exports, applicability and the installed SMA discrepancy.

## Follow the implementation

1. packages/contracts/src/research.ts names source revisions, period types, availability and nullable results.
2. The company-provider port separates retrieval from calculations.
3. SyntheticCompanyProvider declares fictional release times. YahooCompanyProvider preserves original timeseries currency and zero values alongside the SDK-normalized response.
4. CompanyService archives the source before the atomic observation/replay transaction.
5. FintechResearchEngine selects eligible statement revisions and computes three deliberately small descriptive quantities.
6. ResearchService freezes dataset, adjustment and company references, rejecting duplicate listings and future cutoffs.
7. apps/api/src/http/research.ts exposes capture and calculation commands.
8. ResearchDesk presents the exact inputs and unavailable reasons through React.

The adapter preserves missing price slots. The installed numeric SMA is applied independently to each contiguous segment because the optimized implementation rejects null despite the catalog description.

## Recording sequence

1. Resolve synthetic AURA in Instrument discovery and capture its clean September candles.
2. Open Research & evidence. Capture annual standard company statements.
3. Select the clean dataset and captured statements. Calculate at the current cutoff.
4. Expand trend rows: the first two timestamps remain present with warm-up values. The first complete mean is (101 + 102 + 103) / 3 = 102.
5. Read net income / revenue: 180 / 1,200 × 100 = 15%. The prior period was 10%, so the change is +5 percentage points.
6. Capture the late-revision scenario. Its corrected net income is 150, producing 12.5% after September 20. An earlier cutoff retains 15%, while prices fetched later become unavailable at that cutoff.
7. Capture missing net income or zero revenue. The diagnostic has a reason and no score.
8. Select the historical strategy evidence check. Current reconstructed candle history is rejected. Authored company release evidence remains explicitly fictional.
9. Inspect selected-universe breadth, source hashes, frozen references and the disabled recommendation action.

One advancing listing gives net advances +1. A missing second member reduces coverage to 50% and makes net advances unavailable. This is not an exchange-wide statistic.

## Routes and checkpoints

| Route                                           | Purpose                                   |
| ----------------------------------------------- | ----------------------------------------- |
| POST /api/v1/company-observations               | Capture company facts with source archive |
| GET /api/v1/company-observations                | List current observation revisions        |
| GET /api/v1/company-observations/:id?revision=1 | Read an exact immutable revision          |
| POST /api/v1/research-runs                      | Freeze and calculate selected inputs      |
| GET /api/v1/research-runs and /:id              | Replay saved research evidence            |

| Task                             | Commit           |
| -------------------------------- | ---------------- |
| Definitions and contracts        | 6d96aec          |
| Company retrieval                | f5a5799          |
| Research calculations            | 71d0200          |
| API and React panel              | 81dde57          |
| Final checks and recording notes | chapter-7 task-5 |

## Observed evidence

Strict type checks, four independent engine cases, nine focused Yahoo adapter cases, the research API journey and connected Chromium walkthrough passed during task development. Final suite outcomes are in [progress](../progress.md).

The opt-in actual Yahoo company smoke succeeded at 2026-09-22T12:47:34.602Z. It returned three annual AAPL periods, each with USD currency, 12M type and current observation availability. Archived source hash: d2739ee48c031a95eed0c59a7f70419f012e360a2b0cc0b0050e1e61429b068b. This verifies provider shape, not independent issuer filing accuracy.

Run it with YAHOO_ENABLED=true and npm run yahoo:company-smoke. Source payloads remain in ignored local storage. Desktop and 390px screenshots are artifacts/chapter-7-desktop.png and chapter-7-mobile.png.

## Next chapter

Chapter 8 builds aligned return matrices and risk estimates. Research observations alone do not constitute historical strategy evidence, a forecast or an order.
