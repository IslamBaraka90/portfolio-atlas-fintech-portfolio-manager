import { z } from "zod";
import { currencySchema } from "./mandates.js";
import { snapshotRefSchema } from "./valuation.js";
export const returnBasisSchema = z.enum(["price", "gross_total_return"]);
export const benchmarkDefinitionInputSchema = z
  .strictObject({
    name: z.string().trim().min(3).max(100),
    currency: currencySchema,
    returnBasis: returnBasisSchema,
    adjustmentRuns: z.array(snapshotRefSchema).min(1).max(20),
  })
  .refine((v) => new Set(v.adjustmentRuns.map((r) => r.id)).size === v.adjustmentRuns.length, {
    message: "Duplicate constituent source.",
  });
export type BenchmarkDefinitionInput = z.infer<typeof benchmarkDefinitionInputSchema>;
export const benchmarkDefinitionSchema = z.strictObject({
  id: z.string(),
  revision: z.literal(1),
  createdAt: z.iso.datetime(),
  input: benchmarkDefinitionInputSchema,
  weighting: z.literal("equal_weight_at_start"),
  rebalance: z.literal("start_only_buy_and_hold"),
  incomeConvention: z.enum(["excluded", "gross_reinvested_no_tax"]),
  policyVersion: z.literal("chapter-6.v1"),
});
export type BenchmarkDefinition = z.infer<typeof benchmarkDefinitionSchema>;
export const benchmarkResultSchema = z.strictObject({
  id: z.string(),
  createdAt: z.iso.datetime(),
  definition: benchmarkDefinitionSchema,
  status: z.enum(["ready", "unsupported"]),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  constituents: z.array(
    z.strictObject({
      instrumentId: z.string(),
      adjustmentRun: snapshotRefSchema,
      dataset: snapshotRefSchema,
      sourceHash: z.string(),
      initialWeight: z.number().finite().nonnegative(),
    }),
  ),
  series: z.array(
    z.strictObject({
      date: z.iso.date(),
      level: z.number().finite().positive(),
      returnFromStart: z.number().finite(),
    }),
  ),
  totalReturn: z.number().finite().nullable(),
  packageVersion: z.literal("0.13.2"),
  verification: z.literal("verified_shared_fixture_parity"),
});
export type BenchmarkResult = z.infer<typeof benchmarkResultSchema>;
export const benchmarkComparisonSchema = z.strictObject({
  benchmarkId: z.string(),
  requestedBasis: returnBasisSchema,
  requestedCurrency: currencySchema,
  status: z.enum(["compatible", "incompatible", "unavailable"]),
  reasons: z.array(z.string()),
});
