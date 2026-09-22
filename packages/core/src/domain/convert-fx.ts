import { fxObservationSchema, type FxObservation } from "@portfolio-atlas/contracts";
export function convertFx(
  amount: number,
  from: string,
  to: string,
  observation: FxObservation,
  asOf: string,
): number {
  const fx = fxObservationSchema.parse(observation);
  if (!Number.isFinite(amount) || !Number.isFinite(Date.parse(asOf)))
    throw new Error("FX input amount and valuation time must be valid.");
  const now = Date.parse(asOf),
    observed = Date.parse(fx.observedAt),
    available = Date.parse(fx.availableAt);
  if (observed > now || available > now || available < observed)
    throw new Error("FX evidence is not available at the requested valuation time.");
  if (now - observed > fx.maxAgeSeconds * 1000)
    throw new Error("FX observation exceeds its freshness budget.");
  let result: number;
  if (from === fx.baseCurrency && to === fx.quoteCurrency) result = amount * fx.quotePerBase;
  else if (from === fx.quoteCurrency && to === fx.baseCurrency) result = amount / fx.quotePerBase;
  else throw new Error("FX observation does not support this currency direction.");
  if (!Number.isFinite(result)) throw new Error("FX conversion overflowed.");
  return result;
}
