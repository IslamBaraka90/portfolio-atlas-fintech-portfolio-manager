import { z } from "zod";
import {
  instrumentSchema,
  dataModeSchema,
  providerFailureSchema,
  quoteUnitSchema,
} from "./instruments.js";

export const ingestionRequestSchema = z
  .strictObject({
    instrumentId: z.string().min(1),
    instrumentRevision: z.number().int().positive(),
    from: z.iso.date(),
    to: z.iso.date(),
    scenario: z.enum(["clean", "adversarial"]).default("clean"),
  })
  .refine(
    (v) =>
      Date.parse(v.to) > Date.parse(v.from) &&
      Date.parse(v.to) - Date.parse(v.from) <= 366 * 86400000,
    {
      message: "Use an exclusive end after the start, at most 366 days apart.",
      path: ["to"],
    },
  );
export type IngestionRequest = z.infer<typeof ingestionRequestSchema>;
export const barObservationSchema = z.strictObject({
  rowId: z.string(),
  sourceIndex: z.number().int().nonnegative(),
  symbol: z.string(),
  timestamp: z.string().nullable(),
  sessionDate: z.string().nullable(),
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  close: z.number().nullable(),
  volume: z.number().nullable(),
  adjustedClose: z.number().nullable(),
  finality: z.enum(["final", "incomplete", "unknown"]),
  evidence: z.string(),
});
export type BarObservation = z.infer<typeof barObservationSchema>;
export const validationFindingSchema = z.strictObject({
  code: z.string(),
  reason: z.string(),
  severity: z.enum(["error", "warning"]),
});
export type ValidationFinding = z.infer<typeof validationFindingSchema>;
export const rowQualitySchema = z.strictObject({
  index: z.number().int().nonnegative(),
  rowId: z.string(),
  accepted: z.boolean(),
  findings: z.array(validationFindingSchema),
});
export type RowQuality = z.infer<typeof rowQualitySchema>;
export const qualityReportSchema = z.strictObject({
  policyVersion: z.literal("chapter-3.v1"),
  acceptedIndexes: z.array(z.number().int()),
  quarantinedIndexes: z.array(z.number().int()),
  rows: z.array(rowQualitySchema),
  coverage: z.strictObject({
    expectedSessions: z.number().int().nullable(),
    observedSessions: z.number().int(),
    missingSessions: z.array(
      z.strictObject({ sessionDate: z.iso.date(), classification: z.string(), reason: z.string() }),
    ),
    evidence: z.string(),
  }),
  warnings: z.array(z.string()),
});
export type QualityReport = z.infer<typeof qualityReportSchema>;
export const marketDatasetSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  instrument: instrumentSchema,
  request: ingestionRequestSchema,
  source: dataModeSchema,
  observedAt: z.iso.datetime(),
  cache: z.enum(["fresh", "hit"]),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  archiveRef: z.string(),
  interval: z.literal("1d"),
  timezone: z.string().nullable(),
  quoteUnit: quoteUnitSchema,
  basis: z.enum(["synthetic_unadjusted", "provider_returned"]),
  availability: z.literal("observed_now_not_historical"),
  rows: z.array(barObservationSchema),
  quality: qualityReportSchema,
});
export type MarketDataset = z.infer<typeof marketDatasetSchema>;
export const ingestionResultSchema = z.strictObject({
  status: z.enum(["ingested", "unavailable"]),
  source: dataModeSchema,
  dataset: marketDatasetSchema.nullable(),
  failure: providerFailureSchema.nullable(),
});
export type IngestionResult = z.infer<typeof ingestionResultSchema>;
