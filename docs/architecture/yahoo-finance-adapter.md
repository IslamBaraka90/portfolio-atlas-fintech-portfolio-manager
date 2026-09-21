# Yahoo Finance adapter contract

Status: specified and dependency installed; implementation begins in Chapters 2–3. Package: yahoo-finance2 4.0.2. Boundary: packages/adapters/src/market-data/yahoo-finance.

Read the package's installed agent skill and declarations before implementing. The current npm major is v4; the bundled skill still contains some v3 wording. The installed v4 declarations own the call contract.

## Ownership and request path

React requests our API. A use case calls a market-data port. The Yahoo adapter owns the YahooFinance instance, module calls, response parsing, error translation, request budget, and local cache. It returns provider-neutral records and evidence.

fintech-algorithms does not fetch data. Its adapter evaluates normalized records after provider and schema checks. See [Wiring up a data provider](https://docs.thefintechbuilder.com/guides/data-providers/).

## Planned capabilities

| Port operation                                | Yahoo module                                                    | Introduced |
| --------------------------------------------- | --------------------------------------------------------------- | ---------- |
| Search instrument candidates                  | search                                                          | Chapter 2  |
| Observe identity and quote metadata           | quote; selected quoteSummary modules where needed               | Chapter 2  |
| Retrieve daily candles and events             | chart with explicit period1, period2, interval and array return | Chapter 3  |
| Observe dividends and splits                  | chart events                                                    | Chapter 4  |
| Retrieve company statements                   | fundamentalsTimeSeries after verifying its installed contract   | Chapter 7  |
| Observe profile and selected valuation fields | quoteSummary with only required modules                         | Chapter 7  |

No live provider request is required to validate this planning foundation. Future integration tests are opt-in. Public documentation must distinguish provider observation from authoritative security-master evidence.

## Mapping chart results

Verified against the installed esm/src/modules/chart.d.ts. Array results have meta, optional events, and quotes. Chart quote rows have date, open, high, low, close, volume, and optional adjclose; OHLCV fields may be null.

| Provider field                           | Application destination                 | Rule                                                                       |
| ---------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| meta.symbol                              | providerSymbol on the alias and lineage | Retain requested and returned symbol; reconcile differences                |
| meta.currency                            | observed quote currency/unit evidence   | Normalize subunits explicitly; do not assume a three-letter ISO currency   |
| meta.exchangeName / exchangeTimezoneName | observed venue/timezone                 | Exchange label is not automatically a canonical MIC                        |
| quote.date                               | observation timestamp                   | Package Date becomes ISO; record interval/session semantics separately     |
| quote.open/high/low/close                | provider OHLC                           | Preserve provider-returned basis and check finite values                   |
| quote.volume                             | observed volume                         | Preserve null separately from valid zero; validate units and nonnegativity |
| quote.adjclose                           | separate adjustedClose field            | Never replace only close while retaining a different OHLC basis            |
| events.dividends                         | observed corporate-action candidate     | Amount/date are incomplete entitlement evidence by themselves              |
| events.splits                            | observed split candidate                | Preserve numerator, denominator, ratio, date, and observation provenance   |
| meta.priceHint                           | display precision hint                  | Never infer legal tick size from this alone                                |
| meta.currentTradingPeriod                | current session evidence                | Insufficient to establish all historical sessions or finality              |

Yahoo's provider-returned OHLC must not be labeled exchange-unadjusted without evidence. Corporate-action behavior and revision history are researched in Chapter 4. Adjclose is a separate series with a separate basis.

## Normalized application record

Each row contains instrumentId, providerSymbol, source, sourceRowId, timestamp, sessionDate, interval, OHLCV values, currency/unit scale, adjustmentBasis, finality, fetchedAt, availableAt if evidenced, and datasetId/revision. Keep original nullable values and validation findings together.

The fintech OHLC adapter projects accepted-shape rows to the installed validator contract: bar_id, source, symbol, timestamp, open, high, low, close, and volume. The application owns stable IDs and full provenance.

The verified export is validateBars from fintech-algorithms/market-data-engineering/cleaning-and-validation/ohlc-consistency-validator. Its row results include index, timestamp, valid, issues, tolerancePriceUnits, normalizedPrices, provenance, and rawBar. Branch on valid. This topic's package verification tier is contract.

OHLC geometry validation does not establish trading-session completeness, exchange eligibility, price-basis consistency, or tick-size authority. Add those application checks and other verified package guards separately.

## Rejections, gaps, and freshness

Retain rejected rows and their original time positions in dataset evidence. Build analytics windows only under an explicit gap policy. Never silently compress rows or fill price/volume nulls with zero. Do not infer that a final array row is a closed candle.

Incomplete sessions require exchange-calendar evidence and a controllable clock. Unknown finality remains unknown. A currently observed historical response cannot reconstruct when every fact originally became available.

Timeout, throttling, invalid symbol, delisted/unavailable history, empty interval, and schema mismatch produce distinct provider-neutral failures. Retries are bounded and recorded; validation failures do not disable upstream validation automatically.

## Cache and reliability contract

Cache keys include provider, symbol, interval, requested window, event and adjustment options, and adapter version. Record fetchedAt, observed provider timestamps, freshness policy, and payload hash. A stale cached result remains visibly stale.

Enforce request concurrency and timeout in the adapter/composition layer using verified SDK options and, where necessary, our own port-level controls. Never invent an SDK timeout parameter. No Yahoo client or cookie enters the browser bundle.

## Acceptance scenarios

Chapter 2 proves ambiguous aliases remain unresolved, unknown tick sizes remain unknown, and provider errors have typed outcomes. Chapter 3 proves null rows, duplicate times, inverted high/low, symbol mismatch, malformed dates, zero volume, and partial sessions produce appropriate findings without losing lineage.

Chapter 4 proves adjusted-close isolation and split/dividend continuity without double adjustment. Chapter 7 proves the fetchedAt timestamp is not misrepresented as an original filing availability time.

Default fixtures mimic the installed Yahoo response shape but use synthetic data. Live smoke checks identify requested symbols, observation time, payload mode and limitations; they do not publish entire provider datasets automatically.

## Primary references

- [Yahoo Finance repository and current usage](https://github.com/gadicc/yahoo-finance2)
- Installed node_modules/yahoo-finance2/skills/yahoo-finance2/SKILL.md
- Installed node_modules/yahoo-finance2/esm/src/modules/chart.d.ts
- Installed node_modules/fintech-algorithms/docs.json, topic D01-F02-A01
- [Fintech provider integration guide](https://docs.thefintechbuilder.com/guides/data-providers/)
