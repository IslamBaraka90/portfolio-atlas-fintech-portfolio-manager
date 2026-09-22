import { z } from "zod";
import { identifierSchema } from "./mandates.js";

export const dataModeSchema = z.enum(["synthetic", "yahoo"]);
export const providerSymbolSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9.^=_-]+$/);
export const instantSchema = z.iso.datetime();
export const quoteUnitSchema = z.strictObject({
  reported: z.string().nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  scaleToCurrency: z.number().positive().nullable(),
  evidence: z.string(),
});
export const instrumentCandidateSchema = z.strictObject({
  candidateId: identifierSchema,
  providerSymbol: providerSymbolSchema,
  name: z.string(),
  observedVenue: z.string().nullable(),
  assetType: z.enum(["equity", "etf", "unsupported", "unknown"]),
  quoteUnit: quoteUnitSchema,
  source: dataModeSchema,
  observedAt: instantSchema,
});
export const instrumentAliasSchema = z.strictObject({
  assertionId: identifierSchema,
  revision: z.number().int().positive(),
  provider: dataModeSchema,
  symbol: providerSymbolSchema,
  venueMic: z.string().nullable(),
  listingId: identifierSchema,
  validFrom: instantSchema,
  validTo: instantSchema.nullable(),
  observedAt: instantSchema,
  availableAt: instantSchema,
  evidenceSource: z.string(),
});
export const instrumentSchema = z.strictObject({
  instrumentId: identifierSchema,
  listingId: identifierSchema,
  issuerId: identifierSchema.nullable(),
  name: z.string(),
  revision: z.number().int().positive(),
  requestedSymbol: providerSymbolSchema,
  returnedSymbol: providerSymbolSchema,
  source: dataModeSchema,
  observedAt: instantSchema,
  quoteTime: instantSchema.nullable(),
  observedVenue: z.string().nullable(),
  venueMic: z.string().nullable(),
  timezone: z.string().nullable(),
  quoteUnit: quoteUnitSchema,
  assetType: z.enum(["equity", "etf", "unsupported", "unknown"]),
  sector: z.string().nullable(),
  tickSize: z.number().positive().nullable(),
  lotSize: z.number().positive().nullable(),
  tradingUnitEvidence: z.string().nullable(),
  identityStatus: z.enum(["synthetic_verified", "provider_observed"]),
  aliases: z.array(instrumentAliasSchema),
  warnings: z.array(z.string()),
});
export const providerFailureSchema = z.strictObject({
  code: z.enum([
    "DISABLED",
    "TIMEOUT",
    "THROTTLED",
    "NOT_FOUND",
    "SCHEMA_MISMATCH",
    "NETWORK",
    "BUDGET_EXCEEDED",
  ]),
  message: z.string(),
  retryable: z.boolean(),
});
export const searchResultSchema = z.strictObject({
  status: z.enum(["available", "unavailable"]),
  source: dataModeSchema,
  observedAt: instantSchema,
  cache: z.enum(["fresh", "hit", "none"]),
  candidates: z.array(instrumentCandidateSchema),
  failure: providerFailureSchema.nullable(),
});
export const resolveResultSchema = z.strictObject({
  source: dataModeSchema,
  status: z.enum(["resolved", "unresolved", "unavailable"]),
  instrument: instrumentSchema.nullable(),
  reasons: z.array(z.string()),
  failure: providerFailureSchema.nullable(),
});
export const eligibilityDecisionSchema = z.strictObject({
  instrumentId: identifierSchema,
  instrumentRevision: z.number().int().positive(),
  mandateId: identifierSchema,
  mandateRevision: z.number().int().positive(),
  evaluatedAt: instantSchema,
  status: z.enum(["eligible", "ineligible", "unresolved"]),
  findings: z.array(
    z.strictObject({
      code: z.string(),
      status: z.enum(["pass", "fail", "unknown"]),
      reason: z.string(),
    }),
  ),
  policyVersion: z.literal("chapter-2.v1"),
});
export const aliasQuerySchema = z.strictObject({
  symbol: providerSymbolSchema,
  venueMic: z.string().regex(/^[A-Z0-9]{4}$/),
  // The installed D02 function accepts whole-second UTC instants only.
  validAt: z.iso.datetime({ precision: 0 }),
  knowledgeAt: z.iso.datetime({ precision: 0 }),
});
export const aliasResultSchema = z.object({
  status: z.enum(["resolved", "ambiguous", "unmapped"]),
  canonicalId: z.string().nullable(),
  candidateCanonicalIds: z.array(z.string()),
  reason: z.string(),
});
export type DataMode = z.infer<typeof dataModeSchema>;
export type QuoteUnit = z.infer<typeof quoteUnitSchema>;
export type InstrumentCandidate = z.infer<typeof instrumentCandidateSchema>;
export type InstrumentAlias = z.infer<typeof instrumentAliasSchema>;
export type Instrument = z.infer<typeof instrumentSchema>;
export type ProviderFailure = z.infer<typeof providerFailureSchema>;
export type InstrumentSearchResult = z.infer<typeof searchResultSchema>;
export type InstrumentResolution = z.infer<typeof resolveResultSchema>;
export type EligibilityDecision = z.infer<typeof eligibilityDecisionSchema>;
export type AliasQuery = z.infer<typeof aliasQuerySchema>;
export type AliasResult = z.infer<typeof aliasResultSchema>;
