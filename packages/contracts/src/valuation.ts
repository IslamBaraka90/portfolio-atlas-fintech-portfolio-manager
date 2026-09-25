import { z } from "zod";
import { currencySchema } from "./mandates.js";
import { moneyTextSchema, quantityTextSchema, bookSnapshotSchema } from "./accounting.js";
import { fxObservationSchema } from "./corporate-actions.js";
export const snapshotRefSchema = z.strictObject({
  id: z.string().min(1),
  revision: z.number().int().positive(),
});
export type SnapshotRef = z.infer<typeof snapshotRefSchema>;
export const priceSelectionSchema = z.strictObject({
  instrumentId: z.string().min(1),
  dataset: snapshotRefSchema,
  rowId: z.string().min(1),
  reviewId: z.string().min(1),
});
export const priceOverrideSchema = z.strictObject({
  instrumentId: z.string().min(1),
  currency: currencySchema,
  price: quantityTextSchema.refine((v) => Number(v) > 0),
  quotedAt: z.iso.datetime(),
  reason: z.string().trim().min(10).max(500),
  sourceRef: z.string().trim().min(3).max(200),
});
export const valuationRequestSchema = z
  .strictObject({
    portfolioId: z.string().min(1),
    checkpoint: z.number().int().nonnegative(),
    asOf: z.iso.datetime(),
    maxPriceAgeSeconds: z
      .number()
      .int()
      .min(1)
      .max(30 * 86400)
      .default(10 * 86400),
    prices: z.array(priceSelectionSchema).max(50),
    overrides: z.array(priceOverrideSchema).max(50).default([]),
    fxRuns: z.array(snapshotRefSchema).max(10).default([]),
  })
  .superRefine((v, ctx) => {
    for (const [field, rows] of [
      ["prices", v.prices],
      ["overrides", v.overrides],
    ] as const) {
      if (new Set(rows.map((r) => r.instrumentId)).size !== rows.length)
        ctx.addIssue({
          code: "custom",
          message: "Choose one source per instrument.",
          path: [field],
        });
    }
  });
export type ValuationRequest = z.infer<typeof valuationRequestSchema>;
export const markEvidenceSchema = z.strictObject({
  instrumentId: z.string(),
  currency: currencySchema,
  price: quantityTextSchema.nullable(),
  status: z.enum(["accepted", "overridden", "unavailable"]),
  quotedAt: z.iso.datetime().nullable(),
  observedAt: z.iso.datetime().nullable(),
  dataset: snapshotRefSchema.nullable(),
  rowId: z.string().nullable(),
  sourceHash: z.string().nullable(),
  reviewId: z.string().nullable(),
  override: priceOverrideSchema.nullable(),
  reasons: z.array(z.string()),
  // Chapter 22 live marks name the price they used and the quote it came from.
  // Optional so every earlier snapshot still parses unchanged.
  basis: z.enum(["dataset", "override", "last", "mid", "close"]).optional(),
  quoteId: z.string().nullable().optional(),
});
export type MarkEvidence = z.infer<typeof markEvidenceSchema>;
export const valuedPositionSchema = z.strictObject({
  instrumentId: z.string(),
  currency: currencySchema,
  quantity: quantityTextSchema,
  costBasis: moneyTextSchema,
  mark: markEvidenceSchema,
  marketValueLocal: moneyTextSchema.nullable(),
  marketValueBase: moneyTextSchema.nullable(),
  fxId: z.string().nullable(),
  reasons: z.array(z.string()),
});
export const valuationSnapshotSchema = z.strictObject({
  id: z.string(),
  revision: z.literal(1),
  createdAt: z.iso.datetime(),
  // chapter-6.v1: dataset rows and overrides; chapter-22.live-mark.v1: live quotes.
  policyVersion: z.enum(["chapter-6.v1", "chapter-22.live-mark.v1"]),
  request: valuationRequestSchema,
  baseCurrency: currencySchema,
  book: bookSnapshotSchema,
  status: z.enum(["complete", "incomplete"]),
  positions: z.array(valuedPositionSchema),
  cash: z.array(
    z.strictObject({
      currency: currencySchema,
      amount: moneyTextSchema,
      baseAmount: moneyTextSchema.nullable(),
      fxId: z.string().nullable(),
      reasons: z.array(z.string()),
    }),
  ),
  fxEvidence: z.array(fxObservationSchema),
  totals: z.strictObject({
    cashBase: moneyTextSchema.nullable(),
    holdingsBase: moneyTextSchema.nullable(),
    nav: moneyTextSchema.nullable(),
  }),
  coverage: z.strictObject({
    valuedHoldings: z.number().int(),
    totalHoldings: z.number().int(),
    valuedCashCurrencies: z.number().int(),
    totalCashCurrencies: z.number().int(),
  }),
  externalCapital: z.array(
    z.strictObject({
      currency: currencySchema,
      netContributed: z.string().regex(/^-?\d+\.\d{2}$/),
    }),
  ),
  warnings: z.array(z.string()),
});
export type ValuationSnapshot = z.infer<typeof valuationSnapshotSchema>;
