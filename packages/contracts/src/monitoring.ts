import { instrumentSchema } from "./instruments.js";
import { z } from "zod";
import { snapshotRefSchema, valuationSnapshotSchema } from "./valuation.js";
import { mandateSchema } from "./mandates.js";
import { targetSnapshotSchema } from "./construction.js";
import { riskModelSnapshotSchema } from "./risk-models.js";
export const monitorRequestSchema = z.strictObject({
  valuation: snapshotRefSchema,
  riskModel: snapshotRefSchema.nullable().default(null),
  target: snapshotRefSchema.nullable().default(null),
  shock: z.number().finite().min(-1).max(1).default(-0.1),
});
export type MonitorRequest = z.infer<typeof monitorRequestSchema>;
const exposureSchema = z.strictObject({
  subject: z.string(),
  value: z.string(),
  weight: z.number().finite(),
});
const observationSchema = z.strictObject({
  key: z.string(),
  rule: z.string(),
  subject: z.string(),
  status: z.enum(["pass", "breach", "unavailable"]),
  observed: z.number().finite().nullable(),
  limit: z.number().finite().nullable(),
  reason: z.string(),
  severity: z.enum(["review", "high"]),
});
const historyRiskSchema = z.strictObject({
  status: z.enum(["available", "unavailable"]),
  reason: z.string(),
  returns: z.array(z.number().finite()),
  losses: z.array(z.number().finite()),
  drawdowns: z.array(z.number().finite()),
  maximumDrawdown: z.number().finite().nullable(),
  valueAtRisk: z.number().finite().nullable(),
  confidence: z.literal(0.95),
  horizon: z.literal("one_supplied_daily_interval"),
  quantile: z.literal("linear_index_(n-1)*p"),
  basis: z.literal("hypothetical_current_weights_daily_reset"),
});
export const monitorSnapshotSchema = z.strictObject({
  id: z.string(),
  revision: z.literal(1),
  createdAt: z.iso.datetime(),
  portfolioId: z.string(),
  request: monitorRequestSchema,
  valuation: valuationSnapshotSchema,
  mandate: mandateSchema,
  instruments: z.array(instrumentSchema),
  target: targetSnapshotSchema.nullable(),
  riskModel: riskModelSnapshotSchema.nullable(),
  fresh: z.boolean(),
  freshnessReasons: z.array(z.string()),
  positions: z.array(exposureSchema),
  sectors: z.array(exposureSchema),
  currencies: z.array(exposureSchema),
  scenario: z.array(
    z.strictObject({ subject: z.string(), baseValue: z.string(), change: z.string() }),
  ),
  scenarioTotal: z.string().nullable(),
  proposedScenarioTotal: z.string().nullable(),
  history: historyRiskSchema,
  proposedHistory: historyRiskSchema.nullable(),
  observations: z.array(observationSchema),
  warnings: z.array(z.string()),
  policyVersion: z.literal("chapter-14.v1"),
  packageVersion: z.literal("0.13.2"),
});
export type MonitorSnapshot = z.infer<typeof monitorSnapshotSchema>;
export const riskFindingSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  key: z.string(),
  portfolioId: z.string(),
  rule: z.string(),
  subject: z.string(),
  mandateRevision: z.number().int().positive(),
  severity: z.enum(["review", "high"]),
  status: z.enum(["open", "acknowledged", "escalated", "resolved"]),
  firstSeen: z.iso.datetime(),
  lastSeen: z.iso.datetime(),
  lastRunId: z.string(),
  observation: observationSchema,
  history: z.array(
    z.strictObject({
      at: z.iso.datetime(),
      action: z.string(),
      actor: z.string(),
      reason: z.string(),
      runId: z.string(),
    }),
  ),
});
export type RiskFinding = z.infer<typeof riskFindingSchema>;
export const findingActionSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  action: z.enum(["acknowledge", "escalate", "resolve"]),
  actor: z.string().trim().min(2).max(80),
  reason: z.string().trim().min(10).max(500),
});
export type FindingAction = z.infer<typeof findingActionSchema>;
