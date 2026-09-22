# Chapter 7 — Research evidence contract

## Selected quantities

The research panel computes a three-observation simple moving average by default, common-size income statements focused on net income as a share of revenue, and net advances in the explicitly selected teaching universe. Window size is configurable. These are descriptive observations and never create orders.

A standalone net-profit-margin export was not found. The chosen diagnostic uses the published common-size-statement method and its actual input contract: at least two periods and four consistently ordered lines. It is not presented as a nonexistent margin API.

| Topic       | Exact export / subpath suffix                                                                     | Tier     |
| ----------- | ------------------------------------------------------------------------------------------------- | -------- |
| D07-F01-A01 | calculateSma / technical-indicators/trend-smoothing/sma                                           | verified |
| D18-F01-A06 | commonSizeStatements / fundamental-analysis-and-valuation/statement-ratios/common-size-statements | verified |
| D04-F01-A01 | calculateNetAdvances / market-breadth-and-internals/advance-decline-breadth/net-advances          | verified |

All imports use fintech-algorithms 0.13.2. Verified means shared-fixture parity. Independent examples below are application evidence.

## Company observations and knowledge time

Store immutable observation revisions with instrument evidence, request window, raw archive hash, observed time and all period records. Keep period end, period type, currency, source reference, per-period revision and availability evidence distinct.

For Yahoo, use the installed yahoo-finance2 4.0.2 class and fundamentalsTimeSeries with financials and annual/quarterly frequency. Installed declarations return normalized fields such as totalRevenue, despite older doc examples showing annualTotalRevenue. The SDK normalizer discards currency metadata and skips zero-valued source fields. Preserve the original timeseries JSON through the client's fetch hook, without storing HTTP headers, cookies or crumbs. Validate selected raw fields alongside the SDK result.

Observed source entries contain meta.symbol, meta.type, asOfDate, periodType, currencyCode and reportedValue.raw. Map only TotalRevenue, CostOfRevenue, GrossProfit and NetIncome for the requested frequency. Keep zero when present; missing stays null. Conflicting line values, currencies or period types make that period unusable. No quote currency is borrowed as reporting currency.

A provider period-end label is preserved as reported, not independently verified as a legal filing date. Every live period is available no earlier than its observed fetch time. Yahoo current history does not establish original filing publication or revision availability.

Synthetic company histories declare fictional release times. The late-revision example retains an original and a later corrected period. At a cutoff choose the latest eligible revision per period; never replace the original archive. Only authored release evidence can be used as historical teaching availability in this chapter.

## Common-size applicability

Use the two most recent distinct eligible periods. Require the requested 12M or 3M type, known consistent currency, four finite lines, positive revenue and consistent ordered labels. Reject missing, mixed, future or inconsistent periods. Reject nonconsecutive annual/quarterly spacing rather than joining arbitrary periods.

The four lines are Revenue, Cost of revenue, Gross profit and Net income. Cost of revenue remains a positive expense magnitude from the source. These diagnostic lines are not additive accounting postings. No banking/insurance distress model or sector score is inferred.

Net-income percentage = 100 × net income / revenue; percentage-point change subtracts successive percentages. A negative net income is allowed. Zero/nonpositive revenue makes this comparison unavailable under the application's interpretation policy, even if the generic package permits a signed income denominator.

Independent fixture: prior revenue 1,000, cost 600, gross profit 400, net income 100; later revenue 1,200, cost 720, gross profit 480, net income 180. Focus percentages are 10% and 15%, change +5 percentage points. A later net-income correction to 150 changes the latest percentage to 12.5%, and only after its declared release.

## Trend and participation

Preserve original row IDs and timestamps. Quarantined prices are null inputs; calculateSma propagates nulls and retains window − 1 warm-up positions. Known calendar gaps cannot be silently compressed. The panel explains unavailable windows rather than imputing prices.

Use accepted no-action synthetic closes or a ready split-adjusted research run for the exact dataset revision. A split must not masquerade as a trend break. Total-return-adjusted prices are not substituted for price-trend inputs.

Current research requires the dataset/run to have been observed by the requested cutoff. Existing live and synthetic candle datasets are observed-now histories; they cannot become historical strategy evidence by changing the cutoff.

Breadth compares each selected listing's last two aligned valid closes in consistent share units. It names the selected universe, counts advances/declines/unchanged, retains missing members, and reports coverage. It does not claim to represent all exchange listings. Price tolerance is zero for the deterministic lesson; equal closes are unchanged.

Independent examples: SMA([10,13,12,15],3) = [null,null,35/3,40/3]. One advance, one decline and one unchanged produce net advances zero and full coverage. Missing membership prices reduce coverage instead of disappearing from the denominator.

## Boundaries and sources

The React desk shows period end, observation/availability times, revisions, method, source hashes, raw values and unavailable reasons. Recommendation/execution remains disabled; later chapters enforce mandate-aware decisions.

- [SEC financial-statement guide](https://www.sec.gov/about/reports-publications/investorpubsbegfinstmtguide): income statements describe activity over a reporting period.
- [SEC guide to reading a 10-K](https://www.sec.gov/answers/reada10k.htm): financial statement interpretation includes accounting judgments and supporting disclosures.
- Installed Yahoo source and declarations, plus its [upstream repository](https://github.com/gadicc/yahoo-finance2), own the client contract.
- Package docs and declarations own algorithm signatures; captured common-size examples can be elided, so complete inputs are checked independently.

Read-only AAPL source inspection succeeded at 2026-09-22T12:40:24.488Z with three annual records. The original JSON hash was e0050736a1d4bfb4769c66f40ff6cb77a9be555ace3079c664eea7d9a4bfdb46. This establishes provider shape only, not independent filing verification. Raw response remains in ignored local artifacts.
