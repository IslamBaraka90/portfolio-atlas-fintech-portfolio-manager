import { z } from "zod";
import { snapshotRefSchema } from "./valuation.js";
import { mandateSchema, weightSchema } from "./mandates.js";
import { instrumentSchema } from "./instruments.js";
export const constructionMethodSchema = z.enum([
  "equal_weight",
  "minimum_variance",
  "inverse_volatility",
  "turnover_constrained",
]);
export type ConstructionMethod = z.infer<typeof constructionMethodSchema>;
export const constructionRequestSchema = z.strictObject({
  portfolioId: z.string().min(1),
  mandateRevision: z.number().int().positive(),
  riskModel: snapshotRefSchema,
  valuation: snapshotRefSchema,
  method: constructionMethodSchema,
  cashWeight: weightSchema.default(0.2),
  lambdaRisk: z.number().finite().min(0).max(1000).default(1),
  turnoverCap: z.number().finite().min(0).max(1).default(1),
  estimatedCostBps: z.number().finite().min(0).max(1000).default(0),
  maxCostFraction: z.number().finite().min(0).max(0.2).default(0.01),
  maxIterations: z.number().int().min(0).max(10000).default(5000),
  volatilityStress: z.number().finite().min(0.5).max(3).default(1),
});
export type ConstructionRequest = z.infer<typeof constructionRequestSchema>;
export const constraintSlackSchema = z.strictObject({
  rule: z.string(),
  subject: z.string(),
  status: z.enum(["pass", "fail", "unknown"]),
  observed: z.number().finite().nullable(),
  limit: z.number().finite().nullable(),
  slack: z.number().finite().nullable(),
  explanation: z.string(),
});
export type ConstraintSlack = z.infer<typeof constraintSlackSchema>;
export const solverEvidenceSchema = z.strictObject({
  status: z.string(),
  method: z.string(),
  iterations: z.number().int().nonnegative(),
  solutionClass: z.string().nullable(),
  objective: z.number().finite().nullable(),
  gap: z.number().finite().nullable(),
  budgetResidual: z.number().finite().nullable(),
  details: z.record(z.string(), z.unknown()),
  warnings: z.array(z.string()),
});
export type SolverEvidence = z.infer<typeof solverEvidenceSchema>;
export const targetSnapshotSchema = z.strictObject({
  id: z.string(),
  revision: z.literal(1),
  createdAt: z.iso.datetime(),
  request: constructionRequestSchema,
  mandate: mandateSchema,
  instruments: z.array(instrumentSchema),
  currency: z.string(),
  bookCheckpoint: z.number().int().nonnegative(),
  status: z.enum(["proposal", "candidate_rejected", "infeasible", "unsupported", "solver_failed"]),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  assetIds: z.array(z.string()),
  currentWeights: z.array(z.number().finite()),
  weights: z.array(z.number().finite()).nullable(),
  cashWeight: z.number().finite().nullable(),
  expectedReturn: z.number().finite().nullable(),
  variance: z.number().finite().nullable(),
  volatility: z.number().finite().nullable(),
  varianceContributions: z.array(z.number().finite()).nullable(),
  riskShares: z.array(z.number().finite().nullable()).nullable(),
  turnover: z.number().finite().nullable(),
  riskyTradeNotional: z.number().finite().nullable(),
  estimatedCostFraction: z.number().finite().nullable(),
  constraints: z.array(constraintSlackSchema),
  solver: solverEvidenceSchema.nullable(),
  packageVersion: z.literal("0.13.2"),
  verification: z.literal("contract_tier_with_application_examples"),
  policyVersion: z.literal("chapter-9.v1"),
  createsOrders: z.literal(false),
  executable: z.literal(false),
});
export type TargetSnapshot = z.infer<typeof targetSnapshotSchema>;
