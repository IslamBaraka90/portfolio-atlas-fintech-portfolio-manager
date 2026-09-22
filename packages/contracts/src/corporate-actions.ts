import { z } from "zod";
import { dataModeSchema } from "./instruments.js";
const currency = z.string().regex(/^[A-Z]{3}$/);
export const corporateActionSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  instrumentId: z.string(),
  kind: z.enum(["split", "cash_dividend", "unsupported"]),
  status: z.enum(["candidate", "confirmed", "cancelled"]),
  effectiveDate: z.iso.date().nullable(),
  availableAt: z.iso.datetime(),
  observedAt: z.iso.datetime(),
  source: dataModeSchema,
  sourceRef: z.string(),
  ratio: z.number().positive().nullable(),
  amount: z.number().positive().nullable(),
  currency: currency.nullable(),
  reasons: z.array(z.string()),
});
export type CorporateAction = z.infer<typeof corporateActionSchema>;
export const actionReviewRequestSchema = z.strictObject({
  datasetId: z.string().min(1),
  datasetRevision: z.number().int().positive(),
});
export const actionReviewSchema = z.strictObject({
  id: z.string(),
  createdAt: z.iso.datetime(),
  datasetId: z.string(),
  datasetRevision: z.number().int().positive(),
  sourceHash: z.string(),
  actions: z.array(corporateActionSchema),
  warnings: z.array(z.string()),
});
export type ActionReview = z.infer<typeof actionReviewSchema>;
export const fxObservationSchema = z.strictObject({
  id: z.string(),
  baseCurrency: currency,
  quoteCurrency: currency,
  quotePerBase: z.number().positive(),
  observedAt: z.iso.datetime(),
  availableAt: z.iso.datetime(),
  source: z.string(),
  maxAgeSeconds: z.number().int().positive(),
});
export type FxObservation = z.infer<typeof fxObservationSchema>;
export const adjustmentRequestSchema = z.strictObject({
  reviewId: z.string().min(1),
  actionKnowledgeAt: z.iso.datetime(),
  targetCurrency: z.enum(["USD", "EUR"]).default("EUR"),
});
export type AdjustmentRequest = z.infer<typeof adjustmentRequestSchema>;
const seriesRowSchema = z.strictObject({
  date: z.iso.date(),
  sourceRowId: z.string(),
  providerClose: z.number().positive(),
  splitAdjustedClose: z.number().positive(),
  totalReturnClose: z.number().positive(),
  splitAdjustedVolume: z.number().nonnegative().nullable(),
  convertedClose: z.number().positive().nullable(),
  splitFactor: z.number().positive(),
  dividendFactor: z.number().positive(),
});
export const adjustmentResultSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  status: z.enum(["ready", "unsupported"]),
  datasetId: z.string(),
  datasetRevision: z.number().int().positive(),
  sourceHash: z.string(),
  reviewId: z.string(),
  actionKnowledgeAt: z.iso.datetime(),
  priceObservedAt: z.iso.datetime(),
  method: z.literal("chapter-4.v1_current-price-research"),
  sourceCurrency: currency.nullable(),
  targetCurrency: currency,
  series: z.array(seriesRowSchema),
  selectedActions: z.array(corporateActionSchema),
  excludedActions: z.array(
    z.strictObject({ id: z.string(), revision: z.number().int(), reason: z.string() }),
  ),
  fx: fxObservationSchema.nullable(),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  dividendTreatment: z.literal("embedded_in_total_return_do_not_add_cash_again"),
});
export type AdjustmentResult = z.infer<typeof adjustmentResultSchema>;
