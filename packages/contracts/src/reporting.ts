import { z } from "zod";
import { snapshotRefSchema, valuationSnapshotSchema } from "./valuation.js";
import { portfolioSchema } from "./mandates.js";
import { monitorSnapshotSchema } from "./monitoring.js";
import { performanceSnapshotSchema, attributionResultSchema } from "./performance.js";
import { reconciliationRunSchema } from "./operations.js";
import { targetSnapshotSchema } from "./construction.js";
import { paperBatchSchema } from "./orders.js";
import { researchResultSchema } from "./research.js";
import { marketDatasetSchema } from "./market-data.js";
export const reportRequestSchema = z
  .strictObject({
    portfolioId: z.string().min(1),
    title: z.string().trim().min(3).max(120),
    asOf: z.iso.datetime(),
    dataCutoff: z.iso.datetime(),
    valuation: snapshotRefSchema.nullable().default(null),
    monitor: snapshotRefSchema.nullable().default(null),
    performance: snapshotRefSchema.nullable().default(null),
    attribution: snapshotRefSchema.nullable().default(null),
    reconciliation: snapshotRefSchema.nullable().default(null),
    target: snapshotRefSchema.nullable().default(null),
    batches: z.array(snapshotRefSchema).max(20).default([]),
    research: z.array(snapshotRefSchema).max(10).default([]),
    datasets: z.array(snapshotRefSchema).max(20).default([]),
    supersedes: snapshotRefSchema.nullable().default(null),
  })
  .superRefine((v, c) => {
    if (
      Date.parse(v.asOf) > Date.parse(v.dataCutoff) ||
      [v.batches, v.research, v.datasets].some(
        (rows) => new Set(rows.map((r) => r.id)).size !== rows.length,
      )
    )
      c.addIssue({
        code: "custom",
        message: "Use ordered cutoffs and unique source IDs per section.",
      });
  });
export type ReportRequest = z.infer<typeof reportRequestSchema>;
export const reportEvidenceSchema = z.strictObject({
  valuation: valuationSnapshotSchema.nullable(),
  monitor: monitorSnapshotSchema.nullable(),
  performance: performanceSnapshotSchema.nullable(),
  attribution: attributionResultSchema.nullable(),
  reconciliation: reconciliationRunSchema.nullable(),
  target: targetSnapshotSchema.nullable(),
  batches: z.array(paperBatchSchema),
  research: z.array(researchResultSchema),
  datasets: z.array(marketDatasetSchema),
});
export type ReportEvidence = z.infer<typeof reportEvidenceSchema>;
export const reportSourceSchema = z.strictObject({
  kind: z.string(),
  id: z.string(),
  revision: z.number().int().positive(),
  policyVersion: z.string(),
  recordedAt: z.iso.datetime(),
});
export const reportRowSchema = z.strictObject({
  subject: z.string(),
  metric: z.string(),
  value: z.string().nullable(),
  unit: z.string(),
  currency: z.string().nullable(),
  sourceRef: z.string(),
});
export const reportSectionSchema = z.strictObject({
  key: z.string(),
  title: z.string(),
  status: z.enum(["available", "exceptions", "missing"]),
  asOf: z.iso.datetime(),
  sources: z.array(reportSourceSchema),
  rows: z.array(reportRowSchema),
  notes: z.array(z.string()),
});
export type ReportSection = z.infer<typeof reportSectionSchema>;
export const reportSnapshotSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  portfolio: portfolioSchema,
  request: reportRequestSchema,
  mode: z.enum(["synthetic", "yahoo", "mixed"]),
  currency: z.string(),
  evidence: reportEvidenceSchema,
  sections: z.array(reportSectionSchema),
  insights: z.array(
    z.strictObject({
      id: z.string(),
      asOf: z.iso.datetime(),
      observation: z.string(),
      sourceRef: z.string(),
      action: z.string(),
      chapterHash: z.string(),
    }),
  ),
  coverage: z.strictObject({
    available: z.number().int(),
    exceptions: z.number().int(),
    missing: z.number().int(),
  }),
  navTie: z.strictObject({
    status: z.enum(["reconciled", "unavailable"]),
    holdings: z.string().nullable(),
    economicCash: z.string().nullable(),
    nav: z.string().nullable(),
    residual: z.string().nullable(),
  }),
  status: z.enum(["draft", "approved"]),
  approval: z
    .strictObject({
      actor: z.string(),
      reason: z.string(),
      at: z.iso.datetime(),
      acknowledgedExceptions: z.boolean(),
    })
    .nullable(),
  supersedes: snapshotRefSchema.nullable(),
  warnings: z.array(z.string()),
  policyVersion: z.literal("chapter-16.v1"),
  packageVersion: z.literal("0.13.2"),
});
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
export const reportApprovalSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  actor: z.string().trim().min(2).max(80),
  reason: z.string().trim().min(10).max(500),
  acknowledgeExceptions: z.boolean().default(false),
});
export type ReportApproval = z.infer<typeof reportApprovalSchema>;
