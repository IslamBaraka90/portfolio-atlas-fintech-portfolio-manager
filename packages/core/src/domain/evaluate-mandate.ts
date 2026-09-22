import {
  WEIGHT_SCALE,
  type MandateInput,
  type CandidateAllocation,
  type ConstraintFinding,
  type EvaluationResult,
} from "@portfolio-atlas/contracts";

// Boundary schemas have already checked range and precision. Arithmetic uses integer
// basis points so equality at a cap does not depend on floating-point addition.
const bps = (weight: number) => Math.round(weight * WEIGHT_SCALE);

export function evaluateMandate(
  mandate: MandateInput,
  allocation: CandidateAllocation,
): EvaluationResult {
  const findings: ConstraintFinding[] = [];
  const add = (finding: ConstraintFinding) => findings.push(finding);
  const conflict = (explanation: string) =>
    add({
      code: "POLICY_CONFLICT",
      rule: "Consistent policy",
      subject: "Mandate",
      status: "fail",
      observed: null,
      limit: null,
      comparison: "allowed",
      unit: "policy",
      explanation,
    });
  if (mandate.minCashWeight > mandate.maxCashWeight) conflict("Minimum cash exceeds maximum cash.");
  if (
    mandate.maxCashWeight < 1 &&
    (mandate.allowedAssetTypes.length === 0 ||
      mandate.maxPositionWeight === 0 ||
      mandate.maxSectorWeight === 0)
  )
    conflict("This policy requires invested assets but forbids any positive allocation to them.");

  const ids = allocation.positions.map((position) => position.instrumentId);
  if (new Set(ids).size !== ids.length)
    add({
      code: "DUPLICATE_INSTRUMENT",
      rule: "Unique instruments",
      subject: "Allocation",
      status: "fail",
      observed: ids.length - new Set(ids).size,
      limit: 0,
      comparison: "equal",
      unit: "count",
      explanation: "Use one row per instrument ID; combine duplicate holdings explicitly.",
    });
  const total =
    bps(allocation.cashWeight) +
    allocation.positions.reduce((sum, position) => sum + bps(position.weight), 0);
  add({
    code: "TOTAL_WEIGHT",
    rule: "Fully allocated",
    subject: "Cash + holdings",
    status: total === WEIGHT_SCALE ? "pass" : "fail",
    observed: total / WEIGHT_SCALE,
    limit: 1,
    comparison: "equal",
    unit: "weight",
    explanation: "Cash and holdings must add to exactly 100%.",
  });
  // Structural errors prevent a meaningful policy verdict.
  if (findings.some((finding) => finding.status === "fail")) return { status: "invalid", findings };

  function compare(
    code: ConstraintFinding["code"],
    rule: string,
    subject: string,
    observed: number,
    limit: number,
    comparison: "at_least" | "at_most",
  ) {
    const passes =
      comparison === "at_least" ? bps(observed) >= bps(limit) : bps(observed) <= bps(limit);
    add({
      code,
      rule,
      subject,
      status: passes ? "pass" : "fail",
      observed,
      limit,
      comparison,
      unit: "weight",
      explanation:
        comparison === "at_least"
          ? "The cash reserve must meet the minimum; equality is allowed."
          : "This exposure must stay at or below the limit; equality is allowed.",
    });
  }
  compare(
    "CASH_MINIMUM",
    "Cash floor",
    "Cash",
    allocation.cashWeight,
    mandate.minCashWeight,
    "at_least",
  );
  compare(
    "CASH_MAXIMUM",
    "Cash ceiling",
    "Cash",
    allocation.cashWeight,
    mandate.maxCashWeight,
    "at_most",
  );
  const sectors = new Map<string, number>();
  for (const position of allocation.positions.filter((position) => position.weight > 0)) {
    compare(
      "POSITION_LIMIT",
      "Position cap",
      position.instrumentId,
      position.weight,
      mandate.maxPositionWeight,
      "at_most",
    );
    add({
      code: "ASSET_TYPE",
      rule: "Allowed asset type",
      subject: position.instrumentId,
      status: mandate.allowedAssetTypes.includes(position.assetType) ? "pass" : "fail",
      observed: null,
      limit: null,
      comparison: "allowed",
      unit: "policy",
      explanation:
        position.assetType + "; allowed: " + (mandate.allowedAssetTypes.join(", ") || "none") + ".",
    });
    add({
      code: "RESTRICTED_INSTRUMENT",
      rule: "Restricted instruments",
      subject: position.instrumentId,
      status: mandate.restrictedInstrumentIds.includes(position.instrumentId) ? "fail" : "pass",
      observed: null,
      limit: null,
      comparison: "allowed",
      unit: "policy",
      explanation: mandate.restrictedInstrumentIds.includes(position.instrumentId)
        ? "This instrument ID is restricted by the mandate."
        : "This instrument ID is not restricted by the mandate.",
    });
    if (position.sector === null)
      add({
        code: "UNKNOWN_SECTOR",
        rule: "Sector coverage",
        subject: position.instrumentId,
        status: "not_evaluable",
        observed: null,
        limit: null,
        comparison: "known",
        unit: "policy",
        explanation:
          "A positive holding has no sector. Full sector compliance cannot be established.",
      });
    else sectors.set(position.sector, (sectors.get(position.sector) ?? 0) + bps(position.weight));
  }
  for (const [sector, exposure] of [...sectors].sort(([a], [b]) => a.localeCompare(b))) {
    compare(
      "SECTOR_LIMIT",
      "Sector cap",
      sector,
      exposure / WEIGHT_SCALE,
      mandate.maxSectorWeight,
      "at_most",
    );
  }
  // A known breach remains actionable even when a separate input is unknown.
  const status = findings.some((f) => f.status === "fail")
    ? "breached"
    : findings.some((f) => f.status === "not_evaluable")
      ? "not_evaluable"
      : "satisfied";
  return { status, findings };
}
