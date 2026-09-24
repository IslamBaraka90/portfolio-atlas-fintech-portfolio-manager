import { z } from "zod";
import { instantSchema, providerFailureSchema, providerSymbolSchema } from "./instruments.js";

// Part V live desk (ADR 0005). Demo serves synthetic fixtures; live polls Yahoo.
export const marketDataModeSchema = z.enum(["demo", "live"]);
export const liveCadenceSchema = z.enum(["eod", "15m", "5m", "1m"]);

// Cadence, cache lifetime and freshness move together: a cache that outlives the
// period would serve the previous cycle's observation as if it were new.
export const liveRuntimePolicySchema = z.strictObject({
  version: z.literal("chapter-18.live-runtime.v1"),
  mode: marketDataModeSchema,
  cadence: liveCadenceSchema,
  periodMs: z.number().int().positive(),
  cacheTtlMs: z.number().int().positive(),
  freshnessSeconds: z.number().int().positive(),
  backoffCeilingMs: z.number().int().positive(),
  closeGraceMs: z.number().int().nonnegative(),
  primaryTimezone: z.string().min(1),
  watchlist: z.array(providerSymbolSchema).max(50),
  benchmark: providerSymbolSchema,
  requestsPerMinute: z.number().int().min(1).max(120),
});

// Regular weekday hours only. Holidays and half days are not modeled, so an
// "open" verdict is never proof that the exchange actually traded.
export const sessionStateSchema = z.strictObject({
  timezone: z.string(),
  venueHours: z.string().nullable(),
  state: z.enum(["open", "closed", "unknown"]),
  basis: z.enum(["regular_hours", "weekend", "before_open", "after_close", "unmodeled_timezone"]),
  localDate: z.string().nullable(),
  localTime: z.string().nullable(),
  latestCompletedSession: z.string().nullable(),
  holidays: z.literal("not_modeled"),
});

export const providerHealthSchema = z.strictObject({
  status: z.enum(["idle", "healthy", "degraded", "backing_off"]),
  consecutiveFailures: z.number().int().nonnegative(),
  lastSuccessAt: instantSchema.nullable(),
  lastFailureAt: instantSchema.nullable(),
  lastFailure: providerFailureSchema.nullable(),
  nextAttemptAt: instantSchema.nullable(),
  backoffMs: z.number().int().nonnegative(),
});

export const refreshTaskResultSchema = z.strictObject({
  name: z.string(),
  status: z.enum(["succeeded", "failed", "skipped"]),
  requested: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  detail: z.string(),
  failure: providerFailureSchema.nullable(),
});

export const refreshCycleSchema = z.strictObject({
  id: z.string(),
  sequence: z.number().int().positive(),
  policyVersion: z.string(),
  mode: marketDataModeSchema,
  cadence: liveCadenceSchema,
  trigger: z.enum(["schedule", "manual"]),
  scheduledAt: instantSchema,
  startedAt: instantSchema,
  completedAt: instantSchema,
  session: sessionStateSchema,
  // The completed session this cycle captured after the close, or null intraday.
  coversSession: z.string().nullable(),
  status: z.enum(["completed", "partial", "failed"]),
  tasks: z.array(refreshTaskResultSchema),
  health: providerHealthSchema,
});

export const liveDecisionSchema = z.strictObject({
  at: instantSchema,
  action: z.enum(["run", "skip"]),
  reason: z.string(),
});

export const liveStatusSchema = z.strictObject({
  policy: liveRuntimePolicySchema,
  session: sessionStateSchema,
  health: providerHealthSchema,
  scheduler: z.enum(["stopped", "running"]),
  cycleInProgress: z.boolean(),
  lastDecision: liveDecisionSchema.nullable(),
  nextTickAt: instantSchema.nullable(),
  lastCycle: refreshCycleSchema.nullable(),
  tasks: z.array(z.string()),
});

export const liveEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("cycle"), data: refreshCycleSchema }),
  z.strictObject({ type: z.literal("status"), data: liveStatusSchema }),
]);

export type MarketDataMode = z.infer<typeof marketDataModeSchema>;
export type LiveCadence = z.infer<typeof liveCadenceSchema>;
export type LiveRuntimePolicy = z.infer<typeof liveRuntimePolicySchema>;
export type SessionState = z.infer<typeof sessionStateSchema>;
export type ProviderHealth = z.infer<typeof providerHealthSchema>;
export type RefreshTaskResult = z.infer<typeof refreshTaskResultSchema>;
export type RefreshCycle = z.infer<typeof refreshCycleSchema>;
export type LiveDecision = z.infer<typeof liveDecisionSchema>;
export type LiveStatus = z.infer<typeof liveStatusSchema>;
export type LiveEvent = z.infer<typeof liveEventSchema>;
