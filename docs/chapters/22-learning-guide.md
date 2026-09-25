# Chapter 22 — what is the portfolio worth right now?

Chapter 6 valued the book from chosen dataset rows at a frozen cutoff. The live desk values it every cycle, and each number still has to name the price and rate behind it.

## The mark policy (`chapter-22.live-mark.v1`)

`selectLiveMark` chooses one price per holding, in order:

1. No quote for the holding's symbol, or a quote in another currency: **unavailable**.
2. Live or delayed with a last trade: **last**.
3. Live or delayed with no last trade but a normal or locked book: **midpoint**. A crossed book never has one.
4. Market closed: the last price, which is the session **close**, or the previous close.
5. Stale or unavailable: **unavailable**. Nothing is carried forward past freshness.

Prices keep eight decimal places, the book's unit-price precision. Each mark records its basis, the quote id, provider time, observation time and raw-archive hash.

## One valuation contract

`LiveValuationService` builds an ordinary valuation snapshot: the current reconciled book checkpoint, an empty dataset selection, live marks, and the usable FX observations from Chapter 21. It uses the same `valueBook` arithmetic and decimal rules as Chapter 6 under the policy version `chapter-22.live-mark.v1`. Because it is the same snapshot type, monitoring (Chapter 14), performance (Chapter 15) and reports (Chapter 16) can use live valuations without a second code path. The contract grew only optional `basis` and `quoteId` fields, so every earlier snapshot still parses.

A holding without a usable mark, or a currency without a usable rate, makes the valuation **incomplete**: NAV is null, never a partial sum.

## A NAV series without duplicates

Every cycle values every portfolio, but a NAV point is stored only when the fingerprint changes: book checkpoint, marks with their times, and FX rates with their times. Two cycles over identical inputs share one point, and a manual **Value now** returns the existing point. Points are stored by portfolio and time, read through the indexed prefix query, and published as `nav` events.

## Independent example

A 10,000 USD deposit and a purchase of 10 AURA at 100 leave 9,000 cash. At a live last trade of `p`, NAV is 9,000 + 10p. The API test computes this independently from the observed quote and compares it with the stored point. The next demo minute moves the price and adds a second point.

## Walkthrough

Create a portfolio, deposit and buy a saved instrument, then open **Live portfolio** and select **Value now**. The account summary shows NAV, holdings, economic cash and coverage; the line shows the NAV points; and each holding row names its mark basis, quote time and evidence. A holding bought before any quote cycle has run shows as unavailable and leaves NAV incomplete.

## Recording sequence

Mark policy ladder → crossed book refused → closed-market close → NAV arithmetic → no duplicate point → price move → incomplete valuation named by holding.

Chapter 23 watches this live NAV for drawdowns and limit breaches.
