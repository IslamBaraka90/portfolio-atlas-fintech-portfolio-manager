import { z } from "zod";
import { currencySchema } from "./mandates.js";
export const moneyTextSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,11})(\.\d{1,2})?$/,
    "Use a nonnegative decimal string with at most two places.",
  );
export const quantityTextSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d{0,11})(\.\d{1,8})?$/,
    "Use a nonnegative decimal string with at most eight places.",
  );
const positiveMoney = moneyTextSchema.refine(
  (value) => Number(value) > 0,
  "Amount must be positive.",
);
const positiveQuantity = quantityTextSchema.refine(
  (value) => Number(value) > 0,
  "Quantity/price must be positive.",
);
const base = {
  portfolioId: z.string().min(1),
  sourceRef: z.string().trim().min(3).max(120),
  occurredAt: z.iso.datetime(),
  note: z.string().trim().max(500).default(""),
};
const trade = {
  ...base,
  instrumentId: z.string().min(1),
  instrumentRevision: z.number().int().positive(),
  currency: currencySchema,
  quantity: positiveQuantity,
  unitPrice: positiveQuantity,
  fee: moneyTextSchema.default("0.00"),
  reservationId: z.string().min(1).nullable().default(null),
};
export const postingInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...base,
    kind: z.literal("deposit"),
    currency: currencySchema,
    amount: positiveMoney,
  }),
  z.strictObject({
    ...base,
    kind: z.literal("withdrawal"),
    currency: currencySchema,
    amount: positiveMoney,
  }),
  z.strictObject({
    ...base,
    kind: z.literal("fee"),
    currency: currencySchema,
    amount: positiveMoney,
  }),
  z.strictObject({ ...trade, kind: z.literal("buy") }),
  z.strictObject({ ...trade, kind: z.literal("sell") }),
  z.strictObject({
    ...base,
    kind: z.literal("dividend"),
    instrumentId: z.string().min(1),
    currency: currencySchema,
    amount: positiveMoney,
    evidenceRef: z.string().trim().min(3).max(200),
  }),
  z.strictObject({
    ...base,
    kind: z.literal("split"),
    instrumentId: z.string().min(1),
    ratio: positiveQuantity,
    evidenceRef: z.string().trim().min(3).max(200),
  }),
  z.strictObject({
    ...base,
    kind: z.literal("reserve"),
    reservationId: z.string().min(1).max(120),
    currency: currencySchema,
    amount: positiveMoney,
  }),
  z.strictObject({
    ...base,
    kind: z.literal("release"),
    reservationId: z.string().min(1).max(120),
  }),
]);
export type PostingInput = z.infer<typeof postingInputSchema>;
const reversalInputSchema = z.strictObject({
  ...base,
  kind: z.literal("reversal"),
  originalEventId: z.string().min(1),
  reason: z.string().trim().min(10).max(500),
});
export const ledgerEventSchema = z.strictObject({
  id: z.string(),
  portfolioId: z.string(),
  sequence: z.number().int().positive(),
  recordedAt: z.iso.datetime(),
  input: z.union([postingInputSchema, reversalInputSchema]),
});
export type LedgerEvent = z.infer<typeof ledgerEventSchema>;
export const accountSchema = z.enum([
  "cash",
  "investment_cost",
  "contributed_capital",
  "dividend_income",
  "realized_pnl",
  "fee_expense",
]);
export type Account = z.infer<typeof accountSchema>;
export const journalLineSchema = z.strictObject({
  account: accountSchema,
  currency: currencySchema,
  side: z.enum(["debit", "credit"]),
  amount: positiveMoney,
});
export type JournalLine = z.infer<typeof journalLineSchema>;
export const journalEntrySchema = z.strictObject({
  id: z.string(),
  eventId: z.string(),
  portfolioId: z.string(),
  sequence: z.number().int().positive(),
  kind: z.enum(["posting", "memo"]),
  lines: z.array(journalLineSchema),
});
export type JournalEntry = z.infer<typeof journalEntrySchema>;
export const taxLotSchema = z.strictObject({
  lotId: z.string(),
  acquisitionEventId: z.string(),
  instrumentId: z.string(),
  currency: currencySchema,
  acquiredAt: z.iso.datetime(),
  quantityRemaining: quantityTextSchema,
  costRemaining: moneyTextSchema,
  unitCost: quantityTextSchema,
});
export type TaxLot = z.infer<typeof taxLotSchema>;
export const cashBalanceSchema = z.strictObject({
  currency: currencySchema,
  settled: moneyTextSchema,
  reserved: moneyTextSchema,
  available: moneyTextSchema,
  pending: moneyTextSchema,
});
export const positionSnapshotSchema = z.strictObject({
  instrumentId: z.string(),
  currency: currencySchema,
  quantity: quantityTextSchema,
  pendingQuantity: quantityTextSchema,
  costBasis: moneyTextSchema,
  unitCost: quantityTextSchema,
});
export const reservationSchema = z.strictObject({
  id: z.string(),
  currency: currencySchema,
  amount: moneyTextSchema,
  createdBy: z.string(),
});
export const bookSnapshotSchema = z.strictObject({
  portfolioId: z.string(),
  checkpoint: z.number().int().nonnegative(),
  generatedAt: z.iso.datetime(),
  policyVersion: z.literal("chapter-5.v1"),
  settlementPolicy: z.literal("immediate_teaching"),
  cash: z.array(cashBalanceSchema),
  positions: z.array(positionSnapshotSchema),
  lots: z.array(taxLotSchema),
  reservations: z.array(reservationSchema),
  accounts: z.array(
    z.strictObject({
      currency: currencySchema,
      account: accountSchema,
      debits: moneyTextSchema,
      credits: moneyTextSchema,
      balance: z.string().regex(/^-?\d+\.\d{2}$/),
    }),
  ),
  reconciled: z.boolean(),
  warnings: z.array(z.string()),
});
export type BookSnapshot = z.infer<typeof bookSnapshotSchema>;
export const bookStateSchema = z.strictObject({
  events: z.array(ledgerEventSchema),
  journal: z.array(journalEntrySchema),
  book: bookSnapshotSchema,
});
export type BookState = z.infer<typeof bookStateSchema>;
export const correctionRequestSchema = z.strictObject({
  portfolioId: z.string().min(1),
  originalEventId: z.string().min(1),
  reason: z.string().trim().min(10).max(500),
  replacement: postingInputSchema.nullable(),
});
export type CorrectionRequest = z.infer<typeof correctionRequestSchema>;
