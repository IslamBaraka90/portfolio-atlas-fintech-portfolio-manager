import type { ConstructionRequest, SolverEvidence } from "@portfolio-atlas/contracts";
export interface ConstructionInputs {
  request: ConstructionRequest;
  assetIds: string[];
  annualMeans: number[];
  annualCovariance: number[][];
  returns: number[][];
  currentWeights: number[];
}
export interface ConstructionCalculation {
  succeeded: boolean;
  weights: number[] | null;
  solver: SolverEvidence;
  variance: number | null;
  volatility: number | null;
  expectedReturn: number | null;
  varianceContributions: number[] | null;
  riskShares: (number | null)[] | null;
}
export interface ConstructionEngine {
  calculate(input: ConstructionInputs): ConstructionCalculation;
}
