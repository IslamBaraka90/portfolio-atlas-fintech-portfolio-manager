import { z } from "zod";
import { snapshotRefSchema } from "./valuation.js";
export const riskModelRequestSchema = z
  .strictObject({
    adjustmentRuns: z.array(snapshotRefSchema).min(2).max(8),
    asOf: z.iso.datetime(),
    returnType: z.enum(["simple", "log"]).default("simple"),
    returnBasis: z.enum(["price", "gross_total_return"]).default("gross_total_return"),
    annualization: z.number().int().min(1).max(366).default(252),
    estimator: z.enum(["sample", "ewma", "ledoit_wolf"]).default("sample"),
    decay: z.number().gt(0).lt(1).default(0.94),
    expectedReturnAssumption: z.enum(["zero", "historical_mean", "scenario"]).default("zero"),
    annualExpectedReturns: z
      .array(
        z.strictObject({
          instrumentId: z.string().min(1),
          annualReturn: z.number().finite().gte(-1).lte(5),
        }),
      )
      .max(8)
      .default([]),
  })
  .superRefine((v, ctx) => {
    if (v.expectedReturnAssumption !== "scenario" && v.annualExpectedReturns.length)
      ctx.addIssue({
        code: "custom",
        message: "Scenario values require the scenario assumption.",
        path: ["annualExpectedReturns"],
      });
  });
export type RiskModelRequest = z.infer<typeof riskModelRequestSchema>;
export const matrixDiagnosticsSchema = z.strictObject({
  valid: z.boolean(),
  symmetric: z.boolean(),
  positiveSemidefinite: z.boolean(),
  positiveDefinite: z.boolean(),
  rank: z.number().int().nonnegative(),
  dimension: z.number().int().nonnegative(),
  tolerance: z.number().finite().nonnegative(),
  eigenvalues: z.array(z.number().finite()),
  conditionNumber: z.number().finite().nullable(),
  reasons: z.array(z.string()),
});
export type MatrixDiagnostics = z.infer<typeof matrixDiagnosticsSchema>;
export const riskModelSnapshotSchema = z.strictObject({
  id: z.string(),
  revision: z.literal(1),
  createdAt: z.iso.datetime(),
  request: riskModelRequestSchema,
  status: z.enum(["ready", "unavailable"]),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  assets: z.array(
    z.strictObject({
      instrumentId: z.string(),
      symbol: z.string(),
      dataset: snapshotRefSchema,
      adjustmentRun: snapshotRefSchema,
      sourceHash: z.string(),
      currency: z.string().nullable(),
    }),
  ),
  currency: z.string().nullable(),
  frequency: z.literal("daily"),
  missingPolicy: z.literal("reject_incomplete_aligned_sample"),
  availability: z.literal("current_research_not_point_in_time"),
  intervals: z.array(z.strictObject({ from: z.iso.date(), to: z.iso.date() })),
  returns: z.array(z.array(z.number().finite())),
  dailyMeans: z.array(z.number().finite()),
  annualExpectedReturns: z.array(z.number().finite()),
  covarianceDaily: z.array(z.array(z.number().finite())),
  covarianceAnnual: z.array(z.array(z.number().finite())),
  correlation: z.array(z.array(z.number().finite().nullable())),
  volatilityAnnual: z.array(z.number().finite()),
  observations: z.number().int().nonnegative(),
  diagnostics: matrixDiagnosticsSchema.nullable(),
  estimatorDetails: z.strictObject({
    centering: z.string(),
    denominator: z.number().finite().nullable(),
    shrinkage: z.number().finite().nullable(),
    weightMass: z.number().finite().nullable(),
    seedWeight: z.number().finite().nullable(),
  }),
  packageVersion: z.literal("0.13.2"),
  verification: z.literal("verified_shared_fixture_parity"),
  policyVersion: z.literal("chapter-8.v1"),
});
export type RiskModelSnapshot = z.infer<typeof riskModelSnapshotSchema>;
