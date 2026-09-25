# Chapter 21 — which rate converts this holding, and how old is it?

Chapter 4 used an authored USD→EUR constant and said so. A live desk needs real rates, and a rate is only as trustworthy as its legs and their age.

## Conventions (`chapter-21.fx.v1`)

- A Yahoo leg `XXXUSD=X` quotes USD per one unit of XXX.
- A rate quotes the quote currency per one unit of the base.
- **Direct**: XXX→USD is the leg itself. **Inverse**: USD→XXX is 1 ÷ leg. **Cross via USD**: A→B = AUSD ÷ BUSD.
- A cross rate is timed at the older leg and is as fresh as its least fresh leg.
- Rates keep 10 significant digits; converted money rounds half-even to cents.

## Only the legs you need

`requiredPairs` takes the currencies on the quote board and the base currencies of saved mandates (USD when there are none) and lists every pair a holding might need. Unsupported currencies are reported, not guessed. `requiredLegs` turns those pairs into one USD leg per non-USD currency. A GBP listing in a USD portfolio needs only `GBPUSD=X`; adding a EUR mandate adds `EURUSD=X` and derives GBP→EUR across USD.

## Evidence valuation already understands

Each derived rate carries a standard Chapter 4 `FxObservation`: base, quote, rate, observation time, availability time, source and freshness budget. Chapter 22 hands these to the existing `valueBook` unchanged. Derivation, legs and freshness sit beside the observation so the screen can explain the number. FX legs are classified by the Chapter 19 freshness policy and stored on the quote tape like any quote. A pair whose leg is missing is **unavailable**, with the missing symbol named; it is never converted at 1:1.

`convertWithBoard` converts exact decimals: 100 EUR at 1.08 is 108.00 USD, 108 USD back is 100.00 EUR, and 250 GBP at 1.175925926 is 293.98 EUR. A stale or missing rate refuses; a closed-market rate converts with its label.

In demo mode the same pipeline runs on authored synthetic legs (EUR 1.08, GBP 1.27, EGP 0.0206, SAR 0.2667 USD), labeled as not market quotes.

## Walkthrough

Open **Live FX** and select **Refresh FX**. The demo London listing needs GBP→USD, a direct leg at 1.27. Convert 100 GBP to USD (127.00), then try EUR→USD: the API refuses because no EUR quote or mandate required that leg. With `MARKET_DATA_MODE=live` and `VOD.L` on the watchlist, the same row shows the live `GBPUSD=X` leg and its time.

## Recording sequence

GBp listing → GBP → USD leg → inverse and cross arithmetic → the older-leg timestamp → a missing SAR leg refused → conversion with rounding.

Chapter 22 marks the whole book with live quotes and these rates.
