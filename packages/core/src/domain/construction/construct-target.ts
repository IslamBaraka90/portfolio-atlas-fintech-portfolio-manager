import type {
  ConstructionRequest,
  Mandate,
  RiskModelSnapshot,
  ValuationSnapshot,
  Instrument,
  TargetSnapshot,
  ConstraintSlack,
} from "@portfolio-atlas/contracts";
import type { ConstructionEngine } from "../../ports/construction-engine.js";
import { BookDecimal as D } from "../accounting/decimal.js";
import { evaluateEligibility } from "../instrument-eligibility.js";
type TargetCalculation = Omit<TargetSnapshot, "id" | "revision" | "createdAt">;
export function constructTarget(
  request: ConstructionRequest,
  mandate: Mandate,
  model: RiskModelSnapshot,
  valuation: ValuationSnapshot,
  instruments: Instrument[],
  engine: ConstructionEngine,
  now: string,
): TargetCalculation {
  const ids = model.assets.map((a) => a.instrumentId);
  const result: TargetCalculation = {
    request,
    mandate,
    instruments,
    currency: mandate.baseCurrency,
    bookCheckpoint: valuation.request.checkpoint,
    status: "unsupported",
    reasons: [],
    warnings: [
      "Targets are pre-cost proposals; quantities, financing and post-cost mandate checks belong to the rebalance plan.",
      "Current valuation cash includes reservations; the later order workflow must check available cash.",
      "Selected solvers do not jointly enforce sector and position caps. Every candidate is audited without clipping.",
      "D14 is contract tier. Independent application examples do not establish investment performance.",
    ],
    assetIds: ids,
    currentWeights: [],
    weights: null,
    cashWeight: null,
    expectedReturn: null,
    variance: null,
    volatility: null,
    varianceContributions: null,
    riskShares: null,
    turnover: null,
    riskyTradeNotional: null,
    estimatedCostFraction: null,
    constraints: [],
    solver: null,
    packageVersion: "0.13.2",
    verification: "contract_tier_with_application_examples",
    policyVersion: "chapter-9.v1",
    createsOrders: false,
    executable: false,
  };
  const reject = (status: TargetSnapshot["status"], reason: string) => {
    result.status = status;
    result.reasons.push(reason);
    return result;
  };
  if (
    model.status !== "ready" ||
    !model.diagnostics?.valid ||
    model.request.returnType !== "simple"
  )
    return reject(
      "unsupported",
      "Construction requires a ready simple-return risk model with valid matrix diagnostics.",
    );
  if (
    model.currency !== mandate.baseCurrency ||
    valuation.baseCurrency !== mandate.baseCurrency ||
    valuation.request.portfolioId !== request.portfolioId
  )
    return reject(
      "unsupported",
      "Portfolio, valuation, mandate and risk-model currency must agree.",
    );
  if (
    valuation.status !== "complete" ||
    valuation.totals.nav === null ||
    new D(valuation.totals.nav).lte(0)
  )
    return reject(
      "unsupported",
      "A complete positive-NAV valuation is required to establish current weights.",
    );
  if (instruments.length !== ids.length || instruments.some((v, i) => v.instrumentId !== ids[i]))
    return reject("unsupported", "Instrument evidence must match the exact risk-model order.");
  if (
    instruments.some(
      (v) => v.sector === null || evaluateEligibility(v, mandate, now).status === "unresolved",
    )
  )
    return reject("unsupported", "Sector or instrument eligibility evidence is unresolved.");
  if (valuation.positions.some((p) => new D(p.quantity).gt(0) && !ids.includes(p.instrumentId)))
    return reject(
      "unsupported",
      "The risk universe omits an existing holding; turnover would be incomplete.",
    );
  const nav = new D(valuation.totals.nav);
  result.currentWeights = [
    ...ids.map((id) =>
      new D(valuation.positions.find((p) => p.instrumentId === id)?.marketValueBase ?? "0")
        .div(nav)
        .toNumber(),
    ),
    new D(valuation.totals.cashBase!).div(nav).toNumber(),
  ];
  if (
    result.currentWeights.some((v) => !Number.isFinite(v) || v < 0) ||
    Math.abs(result.currentWeights.reduce((a, b) => a + b, 0) - 1) > 1e-12
  )
    return reject(
      "unsupported",
      "Current normalized holdings do not form a complete nonnegative unit budget.",
    );
  if (mandate.minCashWeight > mandate.maxCashWeight)
    return reject("infeasible", "Mandate minimum cash exceeds maximum cash.");
  const fixed = request.method !== "turnover_constrained";
  if (
    fixed &&
    (request.cashWeight < mandate.minCashWeight || request.cashWeight > mandate.maxCashWeight)
  )
    return reject("infeasible", "The selected fixed reserve is outside the mandate cash bounds.");
  const capacities = new Map<string, number>();
  for (const instrument of instruments) {
    if (evaluateEligibility(instrument, mandate, now).status !== "eligible") continue;
    const sector = instrument.sector!.toUpperCase();
    capacities.set(sector, (capacities.get(sector) ?? 0) + mandate.maxPositionWeight);
  }
  const capacity = [...capacities.values()].reduce(
    (sum, v) => sum + Math.min(v, mandate.maxSectorWeight),
    0,
  );
  if (capacity + (fixed ? request.cashWeight : mandate.maxCashWeight) < 1 - 1e-8)
    return reject(
      "infeasible",
      "Eligible position and sector capacity plus allowed cash cannot fund a complete portfolio.",
    );
  const solved = engine.calculate({
    request,
    assetIds: ids,
    annualMeans: model.annualExpectedReturns,
    annualCovariance: model.covarianceAnnual.map((row) =>
      row.map((v) => v * request.volatilityStress ** 2),
    ),
    returns: model.returns,
    currentWeights: result.currentWeights,
  });
  result.solver = solved.solver;
  result.warnings.push(...solved.solver.warnings);
  if (!solved.succeeded || !solved.weights)
    return reject(
      "solver_failed",
      "The selected method did not return a successful certified candidate.",
    );
  result.weights = solved.weights.slice(0, -1);
  result.cashWeight = solved.weights.at(-1)!;
  result.expectedReturn = solved.expectedReturn;
  result.variance = solved.variance;
  result.volatility = solved.volatility;
  result.varianceContributions = solved.varianceContributions;
  result.riskShares = solved.riskShares;
  const changes = solved.weights.map((w, i) => Math.abs(w - result.currentWeights[i]!));
  result.turnover = 0.5 * changes.reduce((a, b) => a + b, 0);
  result.riskyTradeNotional = changes.slice(0, -1).reduce((a, b) => a + b, 0);
  result.estimatedCostFraction = (result.riskyTradeNotional * request.estimatedCostBps) / 10000;
  const audit = (
    rule: string,
    subject: string,
    observed: number,
    limit: number,
    direction: "min" | "max" | "equal",
    explanation: string,
  ) => {
    const slack =
      direction === "min"
        ? observed - limit
        : direction === "max"
          ? limit - observed
          : -Math.abs(observed - limit);
    result.constraints.push({
      rule,
      subject,
      observed,
      limit,
      slack,
      status: slack >= -1e-8 ? "pass" : "fail",
      explanation,
    });
  };
  audit(
    "BUDGET",
    "Cash + risky assets",
    solved.weights.reduce((a, b) => a + b, 0),
    1,
    "equal",
    "Continuous weights must sum to one.",
  );
  audit(
    "CASH_MINIMUM",
    "Cash",
    result.cashWeight,
    mandate.minCashWeight,
    "min",
    "Cash reserve must satisfy the mandate.",
  );
  audit(
    "CASH_MAXIMUM",
    "Cash",
    result.cashWeight,
    mandate.maxCashWeight,
    "max",
    "Cash remains within its mandate ceiling.",
  );
  const sectors = new Map<string, number>();
  instruments.forEach((instrument, i) => {
    const weight = result.weights![i]!;
    audit("LONG_ONLY", ids[i]!, weight, 0, "min", "No negative exposure is permitted.");
    audit(
      "POSITION_LIMIT",
      ids[i]!,
      weight,
      mandate.maxPositionWeight,
      "max",
      "Solver precision is retained when checking the cap.",
    );
    if (weight <= 1e-8) return;
    const eligible = evaluateEligibility(instrument, mandate, now);
    const row: ConstraintSlack = {
      rule: "ELIGIBILITY",
      subject: ids[i]!,
      observed: null,
      limit: null,
      slack: null,
      status:
        eligible.status === "eligible"
          ? "pass"
          : eligible.status === "unresolved"
            ? "unknown"
            : "fail",
      explanation:
        eligible.findings
          .filter((f) => f.status !== "pass")
          .map((f) => f.reason)
          .join(" ") || "Instrument evidence meets the chapter admission policy.",
    };
    result.constraints.push(row);
    const sector = instrument.sector!.toUpperCase();
    sectors.set(sector, (sectors.get(sector) ?? 0) + weight);
  });
  for (const [sector, exposure] of sectors)
    audit(
      "SECTOR_LIMIT",
      sector,
      exposure,
      mandate.maxSectorWeight,
      "max",
      "Aggregate all held instruments in the same sector.",
    );
  audit(
    "TURNOVER",
    "Half-L1 including cash",
    result.turnover,
    request.turnoverCap,
    "max",
    "Candidate turnover includes the cash coordinate.",
  );
  audit(
    "ESTIMATED_COST",
    "Fraction of starting NAV",
    result.estimatedCostFraction,
    request.maxCostFraction,
    "max",
    "Estimated cost uses absolute risky notional and the supplied basis-point rate.",
  );
  audit(
    "COST_CASH",
    "Proposed cash before costs",
    result.cashWeight,
    result.estimatedCostFraction,
    "min",
    "Estimated fees need cash funding; actual quantities are checked later.",
  );
  const failures = result.constraints.filter((f) => f.status !== "pass");
  if (failures.length)
    return reject("candidate_rejected", failures.map((f) => f.rule + ": " + f.subject).join("; "));
  result.status = "proposal";
  return result;
}
