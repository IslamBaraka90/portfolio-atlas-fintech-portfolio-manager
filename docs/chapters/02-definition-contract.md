# Chapter 2 — Instrument evidence contract

Status: frozen teaching policy chapter-2.v1. The user authorizes continuous work through Chapters 2–8 and a stop before the D14 dependency in Chapter 9.

## Identity is evidence, not a name

Instrument IDs represent securities; listing IDs represent trading lines. Similar names, a shared issuer, or matching prices cannot merge them. An explicit candidate selection permits a fresh provider observation, not a claim of authoritative identity.

Synthetic examples have deliberately authored IDs, listing relationships and rulebook evidence. A newly observed Yahoo symbol receives a session-stable provisional internal ID. It remains provider_observed: permanent issuer/security identity, MIC and trading units are not established from Yahoo alone.

Resolution checks requested versus returned symbol and observed venue. A mismatch is unresolved. A successful search with no matches differs from a failed request.

## Currency and units

Retain the reported code and scale separately. USD/EUR/GBP/EGP/SAR use scale 1 in this initial scope. The explicit GBp/GBX mapping uses GBP and scale 0.01; 125 GBp is GBP 1.25. Unrecognized codes remain unknown; case normalization must not turn GBp into GBP before the subunit check.

priceHint is display metadata and never legal tick size. Missing tick and lot evidence remain null. A different quote currency is unresolved for this chapter's base-currency-only admission policy; FX eligibility follows later.

## Two clocks and alias intervals

Aliases are effective on [validFrom, validTo), with no upper limit when validTo is null. availableAt determines what could be known. The installed D02-F03-A01 resolveIdentifier export requires UTC times with whole seconds. The alias query schema rejects fractional seconds rather than silently truncating them.

The adapter maps aliases to scoped TICKER/trading_line assertions, with an evidenced venue MIC. The returned canonicalId is a listing ID; security identity stays a separate field. A ticker change keeps its listing and instrument IDs. Conflicting mappings remain ambiguous. Yahoo's current observation is never backdated into a historical mapping.

## Eligibility

Evaluate against explicit mandate and instrument revisions. Known unsupported/disallowed types and restricted IDs are ineligible. Otherwise, missing authoritative identity, MIC, timezone, currency conversion basis, or trading-unit evidence is unresolved. A synthetic security with complete evidence can be eligible for the declared teaching scope. This does not authorize an order or regulated suitability.

## Provider reliability

Default mode is synthetic. Yahoo calls require YAHOO_ENABLED=true and explicit yahoo mode. No fallback substitutes synthetic results for a live failure.

Search/quote use the installed YahooFinance v4 class. The adapter limits concurrent calls, rejects excess pending work, bounds elapsed time, uses AbortSignal through verified fetchOptions, and retains typed failures. Cache entries are scoped by operation and input; age is measured from the completed observation. Stale entries are not silently reused.

SDK constructor fetch interception supplies per-request cancellation to cookie/crumb requests as well. Timeout does not free an in-flight concurrency slot until the operation has settled; an uncooperative client cannot turn repeated timeouts into unlimited work.

## Sources and verification

- Installed yahoo-finance2 4.0.2 search.d.ts, quote.d.ts, moduleCommon.d.ts and options/options.d.ts.
- [Yahoo Finance client repository](https://github.com/gadicc/yahoo-finance2): class API and unofficial provider boundary.
- [Provider integration guide](https://docs.thefintechbuilder.com/guides/data-providers/): normalize, validate, compute and report.
- Installed fintech-algorithms 0.13.1 D02-F03-A01: resolveIdentifier; verification tier verified means package TypeScript/Python fixture parity.
- D02-F03-A02 and A03 contracts were inspected for the identity model; this chapter calls A01 only. No redundant import is added for storytelling.

Independent tests will assert old/new ticker continuity, half-open boundaries, unavailable future evidence, overlapping mappings, unsupported types, mismatched symbols, subunit scale and missing tick evidence. Live smoke observations are recorded separately from these deterministic fixtures.
