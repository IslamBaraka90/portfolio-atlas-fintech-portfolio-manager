import type { EligibilityDecision, Instrument, Mandate } from "@portfolio-atlas/contracts";

// This is an admission policy for the teaching universe, not an order approval.
// A known prohibition dominates unknown evidence; both reasons remain visible.
export function evaluateEligibility(
  instrument: Instrument,
  mandate: Mandate,
  evaluatedAt: string,
): EligibilityDecision {
  const findings: EligibilityDecision["findings"] = [];
  const check = (code: string, status: "pass" | "fail" | "unknown", reason: string) =>
    findings.push({ code, status, reason });
  const type = instrument.assetType;
  check(
    "ASSET_TYPE",
    type === "unknown"
      ? "unknown"
      : type === "unsupported" || !mandate.allowedAssetTypes.includes(type)
        ? "fail"
        : "pass",
    "Asset type must be known and allowed by this mandate.",
  );
  check(
    "RESTRICTED_ID",
    mandate.restrictedInstrumentIds.includes(instrument.instrumentId) ? "fail" : "pass",
    "Restrictions apply to the internal security ID, not its current ticker.",
  );
  check(
    "IDENTITY",
    instrument.identityStatus === "synthetic_verified" ? "pass" : "unknown",
    "Provider metadata alone does not establish permanent legal identity.",
  );
  check(
    "VENUE",
    instrument.venueMic ? "pass" : "unknown",
    "A provider exchange label is not an evidenced MIC.",
  );
  check(
    "TIMEZONE",
    instrument.timezone ? "pass" : "unknown",
    "Session interpretation requires an evidenced IANA timezone.",
  );
  check(
    "QUOTE_UNIT",
    instrument.quoteUnit.currency && instrument.quoteUnit.scaleToCurrency ? "pass" : "unknown",
    "Currency and quote-subunit scale must both be known.",
  );
  check(
    "BASE_CURRENCY",
    instrument.quoteUnit.currency === mandate.baseCurrency ? "pass" : "unknown",
    "This chapter admits base-currency instruments; foreign-currency funding needs the later FX policy.",
  );
  check(
    "TRADING_UNITS",
    instrument.tickSize && instrument.lotSize && instrument.tradingUnitEvidence
      ? "pass"
      : "unknown",
    "Tick and lot size require explicit evidence; display precision is insufficient.",
  );
  check(
    "POLICY_TIME",
    Date.parse(evaluatedAt) >= Date.parse(mandate.updatedAt) &&
      Date.parse(evaluatedAt) >= Date.parse(instrument.observedAt)
      ? "pass"
      : "unknown",
    "The decision cannot use a future mandate revision or future observation.",
  );
  return {
    instrumentId: instrument.instrumentId,
    instrumentRevision: instrument.revision,
    mandateId: mandate.id,
    mandateRevision: mandate.revision,
    evaluatedAt,
    status: findings.some((f) => f.status === "fail")
      ? "ineligible"
      : findings.some((f) => f.status === "unknown")
        ? "unresolved"
        : "eligible",
    findings,
    policyVersion: "chapter-2.v1",
  };
}
