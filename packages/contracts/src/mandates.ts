import { z } from "zod";

// The API uses fractions: 0.40 means 40%. Four decimals represent one basis point.
export const WEIGHT_SCALE = 10_000;
export const weightSchema = z
  .number()
  .min(0)
  .max(1)
  .refine(
    (value) => Math.abs(value * WEIGHT_SCALE - Math.round(value * WEIGHT_SCALE)) < 1e-8,
    "Use at most four decimal places for a weight (one basis point).",
  );
export const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);
export const currencySchema = z.enum(["USD", "EUR", "GBP", "EGP", "SAR"]);
export const assetTypeSchema = z.enum(["equity", "etf"]);
const nameSchema = z.string().trim().min(3).max(80);
const unique = <T>(values: T[]) => new Set(values).size === values.length;

export const mandateInputSchema = z.strictObject({
  name: nameSchema,
  objective: z.string().trim().min(3).max(240),
  baseCurrency: currencySchema,
  horizonYears: z.number().int().min(1).max(50),
  minCashWeight: weightSchema,
  maxCashWeight: weightSchema,
  maxPositionWeight: weightSchema,
  maxSectorWeight: weightSchema,
  allowedAssetTypes: z.array(assetTypeSchema).max(2).refine(unique, "Asset types must be unique."),
  restrictedInstrumentIds: z
    .array(identifierSchema)
    .max(100)
    .refine(unique, "Restricted IDs must be unique."),
});
// Cross-field contradictions are evaluated as policy findings, not silently repaired.
export const mandateSchema = mandateInputSchema.extend({
  id: identifierSchema,
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const mandateUpdateSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  mandate: mandateInputSchema,
});

export const positionSchema = z.strictObject({
  instrumentId: identifierSchema,
  name: nameSchema,
  assetType: assetTypeSchema,
  sector: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .transform((value) => value.toUpperCase())
    .nullable(),
  weight: weightSchema,
});
export const candidateAllocationSchema = z.strictObject({
  asOf: z.iso.datetime(),
  cashWeight: weightSchema,
  positions: z.array(positionSchema).max(100),
});
export const evaluationRequestSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  allocation: candidateAllocationSchema,
});
export const portfolioInputSchema = z.strictObject({
  name: nameSchema,
  mandateId: identifierSchema,
});
export const portfolioSchema = portfolioInputSchema.extend({
  id: identifierSchema,
  baseCurrency: currencySchema,
  createdAt: z.iso.datetime(),
});

export const findingSchema = z.strictObject({
  code: z.enum([
    "POLICY_CONFLICT",
    "TOTAL_WEIGHT",
    "DUPLICATE_INSTRUMENT",
    "CASH_MINIMUM",
    "CASH_MAXIMUM",
    "POSITION_LIMIT",
    "SECTOR_LIMIT",
    "ASSET_TYPE",
    "RESTRICTED_INSTRUMENT",
    "UNKNOWN_SECTOR",
    "POLICY_TIME",
  ]),
  rule: z.string(),
  subject: z.string(),
  status: z.enum(["pass", "fail", "not_evaluable"]),
  observed: z.number().nullable(),
  limit: z.number().nullable(),
  comparison: z.enum(["equal", "at_least", "at_most", "allowed", "known"]),
  unit: z.enum(["weight", "count", "policy"]),
  explanation: z.string(),
});
export const evaluationResultSchema = z.strictObject({
  status: z.enum(["satisfied", "breached", "not_evaluable", "invalid"]),
  findings: z.array(findingSchema),
});
export const evaluationSchema = z.strictObject({
  id: identifierSchema,
  mandateId: identifierSchema,
  mandateRevision: z.number().int().positive(),
  policyVersion: z.literal("chapter-1.v1"),
  evaluatedAt: z.iso.datetime(),
  allocation: candidateAllocationSchema,
  result: evaluationResultSchema,
});
export const auditEventSchema = z.strictObject({
  id: identifierSchema,
  action: z.enum([
    "mandate.created",
    "mandate.updated",
    "portfolio.created",
    "allocation.evaluated",
  ]),
  resourceId: identifierSchema,
  revision: z.number().int().positive().nullable(),
  recordedAt: z.iso.datetime(),
  actor: z.literal("local-learner"),
  requestId: z.string(),
});

export type Currency = z.infer<typeof currencySchema>;
export type MandateInput = z.infer<typeof mandateInputSchema>;
export type Mandate = z.infer<typeof mandateSchema>;
export type CandidateAllocation = z.infer<typeof candidateAllocationSchema>;
export type Position = z.infer<typeof positionSchema>;
export type ConstraintFinding = z.infer<typeof findingSchema>;
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;
export type PortfolioInput = z.infer<typeof portfolioInputSchema>;
export type Portfolio = z.infer<typeof portfolioSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
