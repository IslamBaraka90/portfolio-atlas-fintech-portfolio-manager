# PRP 21 — Live foreign exchange

Status: implemented and verified; see docs/chapters/21-learning-guide.md and docs/progress.md. Part V. Chapter: 21. Editorial duration estimate: 12 minutes.

## Learner question and result

**Which exchange rate converts this holding, and how old is it?**

Replace the authored constant FX of Chapter 4 with live Yahoo currency quotes when the desk runs live, with direct, inverse and USD-cross derivation recorded as evidence.

## Prerequisites

Chapter 4 `FxObservation` and `convertFx`; Chapter 19 quote tape and freshness verdicts.

## Sources and conventions

Yahoo currency symbols use `BASEQUOTE=X` (for example `EURUSD=X`, one EUR in USD). A rate is quote currency per unit of base currency. Inverse = 1 / rate with the same observation time. A cross via USD uses the older of the two legs as its time. Rates are decimal strings at 10 significant digits; money conversions keep the existing decimal rounding rules.

## Scope

- Currencies in the mandate set (USD, EUR, GBP, EGP, SAR); pairs derived from holdings and the base currency.
- Freshness uses the Chapter 19 verdict and a separate FX age limit in the runtime policy.
- Unavailable pairs produce an explicit unavailable conversion; valuation marks the position incomplete rather than converting at 1.

## Contracts

`FxObservation` is unchanged (valuation keeps accepting it). A `LiveFxRate` wraps it with `derivation: direct | inverse | cross_usd`, `legs`, `freshness` and reasons. `FxBoard { revision, cycleId, source, rates[], unavailable[] }`; `FxConversion` returns exact half-even cents with the rate used.

## Tasks and commits

1. `chapter-21 task-1: derive fx pairs from holdings to request only needed currency quotes`.
2. `chapter-21 task-2: convert with direct inverse and cross rates to keep fx derivation explicit`.
3. `chapter-21 task-3: publish the live fx board to show rates beside their age`.

## Backend and React outcomes

`LiveFxService` registered as the `fx` task between quotes and bars; `GET /live/fx` and `GET /live/fx/convert`; a Live FX desk with the board, legs and a converter. Tasks 1 and 2 landed in one commit because derivation and conversion share one module and route file.

## Acceptance cases

- [x] EURUSD 1.08 converts 100 EUR to 108.00 USD; the inverse converts 108 USD to 100.00 EUR.
- [x] GBP→EUR via USD uses GBPUSD and EURUSD, and records the older timestamp.
- [x] A missing SAR quote makes a SAR position unavailable, never valued at 1:1.
- [x] Demo mode runs the same pipeline on authored synthetic FX legs labeled as not market quotes; Chapter 4's authored constant is unchanged.

## Validation execution

Decimal conversion tests with independent arithmetic, derivation tests, API and browser checks in demo mode with a scripted provider.

## Video

Start with a London listing held in a USD portfolio; follow GBp → GBP → USD with each timestamp.

## Handoff

Live FX evidence. Chapter 22 uses quotes and FX to mark the book continuously.
