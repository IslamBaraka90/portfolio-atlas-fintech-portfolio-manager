import { z } from "zod";
import { snapshotRefSchema, valuationSnapshotSchema } from "./valuation.js";
import { ledgerEventSchema } from "./accounting.js";
import { currencySchema } from "./mandates.js";
import { benchmarkResultSchema } from "./benchmarks.js";
export const performanceRequestSchema = z
  .strictObject({
    valuations: z.array(snapshotRefSchema).min(2).max(100),
    benchmark: snapshotRefSchema.nullable().default(null),
  })
  .refine((v) => new Set(v.valuations.map((r) => r.id)).size === v.valuations.length, {
    message: "Valuation references must be unique.",
  });
export type PerformanceRequest = z.infer<typeof performanceRequestSchema>;
export const returnMetricSchema = z.strictObject({
  status: z.enum(["available", "unavailable"]),
  value: z.number().finite().nullable(),
  reason: z.string(),
});
export const investorFlowSchema = z.strictObject({
  at: z.iso.datetime(),
  amount: z.string(),
  sourceRef: z.string(),
});
export type InvestorFlow = z.infer<typeof investorFlowSchema>;
export const moneyWeightedSchema = z.strictObject({
  status: z.enum(["solved", "ambiguous", "no_root", "unavailable"]),
  periodReturn: z.number().finite().nullable(),
  annualizedReturn: z.number().finite().nullable(),
  roots: z.array(z.number().finite()),
  signChanges: z.number().int().nonnegative(),
  iterations: z.number().int().nonnegative(),
  residual: z.number().finite().nullable(),
  reason: z.string(),
  bounds: z.tuple([z.number(), z.number()]),
});
export type MoneyWeighted = z.infer<typeof moneyWeightedSchema>;
export const performanceSnapshotSchema = z.strictObject({
  id: z.string(),
  revision: z.literal(1),
  createdAt: z.iso.datetime(),
  portfolioId: z.string(),
  currency: currencySchema,
  request: performanceRequestSchema,
  valuations: z.array(valuationSnapshotSchema),
  events: z.array(ledgerEventSchema),
  externalFlows: z.array(investorFlowSchema),
  investorFlows: z.array(investorFlowSchema),
  periods: z.array(
    z.strictObject({
      from: z.iso.datetime(),
      to: z.iso.datetime(),
      begin: z.string(),
      end: z.string(),
      externalFlow: z.string(),
      fees: z.string(),
      netReturn: z.number().finite().nullable(),
      feeAddedBackReturn: z.number().finite().nullable(),
      reasons: z.array(z.string()),
    }),
  ),
  twr: returnMetricSchema,
  feeAddedBackTwr: returnMetricSchema,
  modifiedDietz: returnMetricSchema,
  moneyWeighted: moneyWeightedSchema,
  investmentProfit: z.string().nullable(),
  benchmark: benchmarkResultSchema.nullable(),
  comparison: z.strictObject({
    status: z.enum(["compatible", "incompatible", "unavailable"]),
    reason: z.string(),
    benchmarkReturn: z.number().finite().nullable(),
    activeReturn: z.number().finite().nullable(),
  }),
  warnings: z.array(z.string()),
  policyVersion: z.literal("chapter-15.v1"),
  feeBasis: z.literal("net_of_recorded_book_costs"),
  incomeBasis: z.literal("received_cash_income_no_tax_model"),
});
export type PerformanceSnapshot = z.infer<typeof performanceSnapshotSchema>;
export const attributionRequestSchema = z
  .strictObject({
    name: z.string().trim().min(3).max(100),
    source: z.literal("authored_sector_example"),
    sourceRef: z.string().trim().min(3).max(200),
    from: z.iso.date(),
    to: z.iso.date(),
    currency: currencySchema,
    benchmarkLabel: z.string().trim().min(3).max(100),
    performance: snapshotRefSchema.nullable().default(null),
    sectors: z
      .array(
        z.strictObject({
          sector: z.string().trim().min(1).max(60),
          portfolioWeight: z.number().finite().min(0).max(1),
          benchmarkWeight: z.number().finite().min(0).max(1),
          portfolioReturn: z.number().finite().min(-1).max(10),
          benchmarkReturn: z.number().finite().min(-1).max(10),
        }),
      )
      .min(1)
      .max(30),
  })
  .superRefine((v, c) => {
    if (
      v.from >= v.to ||
      new Set(v.sectors.map((s) => s.sector)).size !== v.sectors.length ||
      Math.abs(v.sectors.reduce((s, r) => s + r.portfolioWeight, 0) - 1) > 1e-10 ||
      Math.abs(v.sectors.reduce((s, r) => s + r.benchmarkWeight, 0) - 1) > 1e-10
    )
      c.addIssue({
        code: "custom",
        message: "Use a positive period, unique sectors and weights summing to one on each side.",
      });
  });
export type AttributionRequest = z.infer<typeof attributionRequestSchema>;
export const attributionResultSchema = z.strictObject({
  id: z.string(),
  revision: z.literal(1),
  createdAt: z.iso.datetime(),
  request: attributionRequestSchema,
  portfolioReturn: z.number().finite(),
  benchmarkReturn: z.number().finite(),
  activeReturn: z.number().finite(),
  effects: z.array(
    z.strictObject({
      sector: z.string(),
      allocation: z.number().finite(),
      selection: z.number().finite(),
      interaction: z.number().finite(),
      total: z.number().finite(),
    }),
  ),
  allocation: z.number().finite(),
  selection: z.number().finite(),
  interaction: z.number().finite(),
  residual: z.number().finite(),
  reconciled: z.boolean(),
  linkage: z.enum(["standalone_example", "compatible", "incompatible"]),
  linkageReasons: z.array(z.string()),
  warnings: z.array(z.string()),
  policyVersion: z.literal("chapter-15.brinson-fachler.v1"),
});
export type AttributionResult = z.infer<typeof attributionResultSchema>;
