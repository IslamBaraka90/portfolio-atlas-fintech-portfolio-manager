import { z } from "zod";
import { currencySchema, identifierSchema } from "./mandates.js";
import { fxObservationSchema } from "./corporate-actions.js";
import {
  dataModeSchema,
  instantSchema,
  providerFailureSchema,
  providerSymbolSchema,
  quoteUnitSchema,
} from "./instruments.js";

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
  // Recent scheduler decisions, newest first; skipped ticks stay visible here.
  decisions: z.array(liveDecisionSchema).max(20),
  nextTickAt: instantSchema.nullable(),
  lastCycle: refreshCycleSchema.nullable(),
  tasks: z.array(z.string()),
});

// Chapter 19: live quotes. Prices are in currency units after the recorded quote-unit
// scale (GBp 2,510 → 25.10 GBP); `reportedLast` keeps the provider's own figure.
// A missing field is null with a reason, never zero.
export const quoteFreshnessSchema = z.enum([
  "live",
  "delayed",
  "stale",
  "closed_market",
  "unavailable",
]);
export const quoteBookStateSchema = z.enum(["normal", "locked", "crossed", "one_sided", "absent"]);
const price = z.number().finite().nullable();
export const quoteObservationSchema = z.strictObject({
  id: z.string(),
  cycleId: z.string().nullable(),
  symbol: providerSymbolSchema,
  instrumentId: identifierSchema.nullable(),
  source: dataModeSchema,
  observedAt: instantSchema,
  providerTime: instantSchema.nullable(),
  marketState: z.string().nullable(),
  delaySeconds: z.number().int().nonnegative().nullable(),
  quoteUnit: quoteUnitSchema,
  reportedLast: price,
  last: price,
  bid: price,
  ask: price,
  bidSize: price,
  askSize: price,
  open: price,
  high: price,
  low: price,
  previousClose: price,
  volume: price,
  change: price,
  changePercent: price,
  book: z.strictObject({
    state: quoteBookStateSchema,
    spread: price,
    spreadBps: price,
    midpoint: price,
  }),
  freshness: quoteFreshnessSchema,
  ageSeconds: z.number().nullable(),
  reasons: z.array(z.string()),
  sourceHash: z.string().nullable(),
  policy: z.string(),
});
export const quoteBoardSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  cycleId: z.string().nullable(),
  updatedAt: instantSchema.nullable(),
  quotes: z.array(quoteObservationSchema),
});
export const watchlistSchema = z.strictObject({
  revision: z.number().int().positive(),
  symbols: z.array(providerSymbolSchema).max(50),
  updatedAt: instantSchema,
});
export const watchlistChangeSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
  action: z.enum(["add", "remove"]),
  symbol: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(providerSymbolSchema),
});

// Chapter 20: live bars. A series is one symbol at one interval; every bar is its own
// revisioned document, so a forming bar can be revised while final bars never change.
export const liveIntervalSchema = z.enum(["1m", "5m", "15m", "1h", "1d"]);
const findingSchema = z.strictObject({
  code: z.string(),
  reason: z.string(),
  severity: z.enum(["error", "warning"]),
});
export const liveBarSchema = z.strictObject({
  seriesId: z.string(),
  revision: z.number().int().positive(),
  timestamp: instantSchema,
  end: instantSchema,
  sessionDate: z.string().nullable(),
  open: price,
  high: price,
  low: price,
  close: price,
  volume: price,
  finality: z.enum(["final", "incomplete"]),
  finalAt: instantSchema,
  finalityEvidence: z.string(),
  accepted: z.boolean(),
  findings: z.array(findingSchema),
  firstObservedAt: instantSchema,
  observedAt: instantSchema,
  sourceHash: z.string(),
});
export const liveSeriesSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  symbol: providerSymbolSchema,
  instrumentId: identifierSchema.nullable(),
  source: dataModeSchema,
  interval: liveIntervalSchema,
  timezone: z.string().nullable(),
  quoteUnit: quoteUnitSchema,
  policy: z.string(),
  refreshedAt: instantSchema,
  window: z.strictObject({ from: instantSchema, to: instantSchema }),
  sourceHash: z.string(),
  counts: z.strictObject({
    bars: z.number().int().nonnegative(),
    final: z.number().int().nonnegative(),
    forming: z.number().int().nonnegative(),
    quarantined: z.number().int().nonnegative(),
  }),
  lastRefresh: z.strictObject({
    appended: z.number().int().nonnegative(),
    revised: z.number().int().nonnegative(),
    finalized: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
    providerRevisedFinal: z.number().int().nonnegative(),
  }),
  warnings: z.array(z.string()),
});

// Chapter 21: live FX. One Yahoo leg per non-USD currency (XXXUSD=X, USD per unit
// of XXX); other pairs are derived. `observation` is the standard Chapter 4 FX
// evidence that valuation already accepts; derivation, legs and freshness sit beside it.
export const fxDerivationSchema = z.enum(["identity", "direct", "inverse", "cross_usd"]);
export const fxLegSchema = z.strictObject({
  symbol: providerSymbolSchema,
  quoteId: z.string(),
  usdPerUnit: z.string(),
  providerTime: instantSchema.nullable(),
  freshness: quoteFreshnessSchema,
});
export const liveFxRateSchema = z.strictObject({
  base: currencySchema,
  quote: currencySchema,
  // Quote currency per one unit of base, 10 significant digits.
  quotePerBase: z.string(),
  derivation: fxDerivationSchema,
  legs: z.array(fxLegSchema),
  freshness: quoteFreshnessSchema,
  providerTime: instantSchema,
  observation: fxObservationSchema,
  reasons: z.array(z.string()),
});
export const fxBoardSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  cycleId: z.string().nullable(),
  updatedAt: instantSchema.nullable(),
  source: dataModeSchema.nullable(),
  rates: z.array(liveFxRateSchema),
  unavailable: z.array(
    z.strictObject({ base: currencySchema, quote: currencySchema, reason: z.string() }),
  ),
});
export const fxConversionSchema = z.strictObject({
  amount: z.string(),
  from: currencySchema,
  to: currencySchema,
  converted: z.string(),
  rate: liveFxRateSchema.nullable(),
  boardRevision: z.number().int().nonnegative(),
  rounding: z.literal("half-even to 0.01"),
  reasons: z.array(z.string()),
});

// Chapter 22: one NAV point per distinct live valuation. The valuation itself is an
// ordinary valuation snapshot, so monitoring, performance and reports can use it.
export const navPointSchema = z.strictObject({
  portfolioId: z.string(),
  valuationId: z.string(),
  cycleId: z.string().nullable(),
  asOf: instantSchema,
  checkpoint: z.number().int().nonnegative(),
  baseCurrency: currencySchema,
  nav: z.string().nullable(),
  holdings: z.string().nullable(),
  cash: z.string().nullable(),
  status: z.enum(["complete", "incomplete"]),
  valuedHoldings: z.number().int().nonnegative(),
  totalHoldings: z.number().int().nonnegative(),
  fingerprint: z.string(),
});

export const liveEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("quotes"), data: quoteBoardSchema }),
  z.strictObject({ type: z.literal("series"), data: liveSeriesSchema }),
  z.strictObject({ type: z.literal("fx"), data: fxBoardSchema }),
  z.strictObject({ type: z.literal("nav"), data: navPointSchema }),
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
export type QuoteFreshness = z.infer<typeof quoteFreshnessSchema>;
export type QuoteObservation = z.infer<typeof quoteObservationSchema>;
export type QuoteBoard = z.infer<typeof quoteBoardSchema>;
export type Watchlist = z.infer<typeof watchlistSchema>;
export type WatchlistChange = z.infer<typeof watchlistChangeSchema>;
export type LiveInterval = z.infer<typeof liveIntervalSchema>;
export type LiveBar = z.infer<typeof liveBarSchema>;
export type LiveSeries = z.infer<typeof liveSeriesSchema>;
export type LiveFxRate = z.infer<typeof liveFxRateSchema>;
export type FxBoard = z.infer<typeof fxBoardSchema>;
export type FxConversion = z.infer<typeof fxConversionSchema>;
export type NavPoint = z.infer<typeof navPointSchema>;
