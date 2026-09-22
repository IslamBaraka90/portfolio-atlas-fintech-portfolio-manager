import { z } from "zod";
import { instrumentSchema, dataModeSchema } from "./instruments.js";
import { snapshotRefSchema } from "./valuation.js";
export const statementItemsSchema = z.strictObject({
  revenue: z.number().finite().nullable(),
  costOfRevenue: z.number().finite().nullable(),
  grossProfit: z.number().finite().nullable(),
  netIncome: z.number().finite().nullable(),
});
export const companyPeriodSchema = z.strictObject({
  periodEnd: z.iso.date(),
  periodType: z.enum(["12M", "3M"]).nullable(),
  revision: z.number().int().positive(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  availableAt: z.iso.datetime(),
  availabilityBasis: z.enum(["observed_now", "authored_release"]),
  sourceRef: z.string(),
  items: statementItemsSchema,
  reasons: z.array(z.string()),
});
export type CompanyPeriod = z.infer<typeof companyPeriodSchema>;
export const companyRequestSchema = z
  .strictObject({
    instrumentId: z.string().min(1),
    instrumentRevision: z.number().int().positive(),
    from: z.iso.date(),
    to: z.iso.date(),
    frequency: z.enum(["annual", "quarterly"]).default("annual"),
    scenario: z.enum(["standard", "missing", "zero-revenue", "late-revision"]).default("standard"),
  })
  .refine(
    (v) =>
      Date.parse(v.to) > Date.parse(v.from) &&
      Date.parse(v.to) - Date.parse(v.from) <= 6 * 366 * 86400000,
    { message: "Use an exclusive end after start, within six years." },
  );
export type CompanyRequest = z.infer<typeof companyRequestSchema>;
export const companyObservationSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  observedAt: z.iso.datetime(),
  instrument: instrumentSchema,
  request: companyRequestSchema,
  source: dataModeSchema,
  sourceHash: z.string(),
  archiveRef: z.string(),
  periods: z.array(companyPeriodSchema),
  warnings: z.array(z.string()),
});
export type CompanyObservation = z.infer<typeof companyObservationSchema>;
export const companyIngestionSchema = z.strictObject({
  status: z.enum(["ingested", "unavailable"]),
  observation: companyObservationSchema.nullable(),
  reasons: z.array(z.string()),
  retryable: z.boolean(),
});
export const researchSeriesRefSchema = z.strictObject({
  dataset: snapshotRefSchema,
  adjustmentRun: snapshotRefSchema.nullable().default(null),
});
export const researchRequestSchema = z.strictObject({
  series: z.array(researchSeriesRefSchema).min(1).max(20),
  companies: z.array(snapshotRefSchema).max(20).default([]),
  asOf: z.iso.datetime(),
  window: z.number().int().min(2).max(252).default(3),
  purpose: z.enum(["current_research", "historical_strategy"]).default("current_research"),
});
export type ResearchRequest = z.infer<typeof researchRequestSchema>;
export const trendObservationSchema = z.strictObject({
  instrumentId: z.string(),
  dataset: snapshotRefSchema,
  adjustmentRun: snapshotRefSchema.nullable(),
  basis: z.enum(["unadjusted_no_actions", "split_adjusted", "unavailable"]),
  knownAt: z.iso.datetime(),
  status: z.enum(["ready", "unavailable"]),
  reasons: z.array(z.string()),
  rows: z.array(
    z.strictObject({
      sourceRowId: z.string(),
      timestamp: z.string().nullable(),
      sessionDate: z.string().nullable(),
      close: z.number().finite().nullable(),
      sma: z.number().finite().nullable(),
      state: z.enum(["ready", "warmup", "unavailable"]),
    }),
  ),
  latestRelation: z.enum(["above", "below", "equal"]).nullable(),
  warmupSlots: z.number().int().nonnegative(),
});
export type TrendObservation = z.infer<typeof trendObservationSchema>;
export const fundamentalObservationSchema = z.strictObject({
  instrumentId: z.string(),
  company: snapshotRefSchema.nullable(),
  status: z.enum(["ready", "unavailable"]),
  reasons: z.array(z.string()),
  periods: z.array(companyPeriodSchema),
  focusPercentage: z.number().finite().nullable(),
  focusChangePercentagePoints: z.number().finite().nullable(),
  historicalAvailabilityProven: z.boolean(),
  method: z.literal("common_size_income_net_income_share"),
  interpretation: z.string(),
});
export type FundamentalObservation = z.infer<typeof fundamentalObservationSchema>;
export const breadthObservationSchema = z.strictObject({
  status: z.string(),
  sessionDate: z.string().nullable(),
  universeIds: z.array(z.string()),
  advances: z.number().int().nullable(),
  declines: z.number().int().nullable(),
  unchanged: z.number().int().nullable(),
  unclassified: z.number().int().nullable(),
  coverageRatio: z.number().finite().nullable(),
  netAdvances: z.number().int().nullable(),
  reasons: z.array(z.string()),
  interpretation: z.literal(
    "Participation in the selected teaching universe; not a market-wide measure.",
  ),
});
export type BreadthObservation = z.infer<typeof breadthObservationSchema>;
export const researchResultSchema = z.strictObject({
  id: z.string(),
  createdAt: z.iso.datetime(),
  request: researchRequestSchema,
  policyVersion: z.literal("chapter-7.v1"),
  trends: z.array(trendObservationSchema),
  fundamentals: z.array(fundamentalObservationSchema),
  breadth: breadthObservationSchema,
  packageVersion: z.literal("0.13.2"),
  verification: z.literal("verified_shared_fixture_parity"),
  warnings: z.array(z.string()),
  createsOrders: z.literal(false),
});
export type ResearchResult = z.infer<typeof researchResultSchema>;
