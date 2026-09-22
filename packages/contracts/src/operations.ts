import { z } from "zod";
import { currencySchema } from "./mandates.js";
import { snapshotRefSchema } from "./valuation.js";
import {
  moneyTextSchema,
  quantityTextSchema,
  bookStateSchema,
  correctionRequestSchema,
} from "./accounting.js";
export const settlementPolicyInputSchema = z
  .strictObject({
    name: z.string().trim().min(3).max(80),
    timezone: z.literal("UTC").default("UTC"),
    lagBusinessDays: z.number().int().min(0).max(5),
    from: z.iso.date(),
    to: z.iso.date(),
    businessWeekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .default([1, 2, 3, 4, 5]),
    holidays: z.array(z.iso.date()).max(366).default([]),
  })
  .superRefine((v, c) => {
    if (
      v.from > v.to ||
      new Set(v.businessWeekdays).size !== v.businessWeekdays.length ||
      new Set(v.holidays).size !== v.holidays.length ||
      v.holidays.some((d) => d < v.from || d > v.to)
    )
      c.addIssue({
        code: "custom",
        message: "Calendar bounds, weekdays and holidays must be consistent and unique.",
      });
  });
export type SettlementPolicyInput = z.infer<typeof settlementPolicyInputSchema>;
export const settlementPolicySchema = settlementPolicyInputSchema.safeExtend({
  id: z.string(),
  revision: z.literal(1),
  createdAt: z.iso.datetime(),
  source: z.literal("authored_teaching_calendar"),
});
export type SettlementPolicy = z.infer<typeof settlementPolicySchema>;
export const settlementCommandSchema = z
  .strictObject({
    portfolioId: z.string().min(1),
    settlementId: z.string().min(1),
    expectedCheckpoint: z.number().int().nonnegative(),
    kind: z.enum(["settle", "fail"]),
    quantity: quantityTextSchema.nullable().default(null),
    sourceRef: z.string().trim().min(8).max(100),
    reason: z.string().trim().max(500).default(""),
  })
  .superRefine((v, c) => {
    if (
      (v.kind === "settle" && (!v.quantity || Number(v.quantity) <= 0)) ||
      (v.kind === "fail" && v.reason.length < 10)
    )
      c.addIssue({
        code: "custom",
        message: "Settlement needs positive quantity; failure needs a meaningful reason.",
      });
  });
export type SettlementCommand = z.infer<typeof settlementCommandSchema>;
export const statementTradeSchema = z.strictObject({
  lineId: z.string().min(1).max(100),
  fillId: z.string().min(1).nullable(),
  instrumentId: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  currency: currencySchema,
  quantity: quantityTextSchema,
  netCash: moneyTextSchema,
  fee: moneyTextSchema,
  tradeDate: z.iso.date(),
  valueDate: z.iso.date(),
});
export const statementInputSchema = z
  .strictObject({
    portfolioId: z.string().min(1),
    asOf: z.iso.datetime(),
    sourceRef: z.string().trim().min(3).max(200),
    source: z.literal("synthetic_custodian_statement"),
    trades: z.array(statementTradeSchema).max(100),
    positions: z
      .array(
        z.strictObject({
          instrumentId: z.string().min(1),
          currency: currencySchema,
          settledQuantity: quantityTextSchema,
        }),
      )
      .max(50),
    cash: z.array(z.strictObject({ currency: currencySchema, settled: moneyTextSchema })).max(5),
    actions: z
      .array(
        z.strictObject({
          actionRef: z.string().min(1),
          instrumentId: z.string(),
          currency: currencySchema,
          amount: moneyTextSchema,
        }),
      )
      .max(100)
      .default([]),
  })
  .superRefine((v, c) => {
    for (const rows of [
      v.trades.map((t) => t.lineId),
      v.positions.map((p) => p.instrumentId),
      v.cash.map((p) => p.currency),
      v.actions.map((a) => a.actionRef),
    ])
      if (new Set(rows).size !== rows.length)
        c.addIssue({
          code: "custom",
          message: "Statement line IDs and balance/action keys must be unique.",
        });
  });
export type StatementInput = z.infer<typeof statementInputSchema>;
export const statementSnapshotSchema = statementInputSchema.safeExtend({
  id: z.string(),
  revision: z.number().int().positive(),
  importedAt: z.iso.datetime(),
});
export type StatementSnapshot = z.infer<typeof statementSnapshotSchema>;
export const reconciliationRequestSchema = z
  .strictObject({
    statement: snapshotRefSchema,
    checkpoint: z.number().int().nonnegative(),
    batches: z.array(snapshotRefSchema).max(20),
  })
  .superRefine((v, c) => {
    if (new Set(v.batches.map((b) => b.id)).size !== v.batches.length)
      c.addIssue({ code: "custom", message: "Select each batch once." });
  });
export type ReconciliationRequest = z.infer<typeof reconciliationRequestSchema>;
export const reconciliationBreakSchema = z.strictObject({
  id: z.string(),
  category: z.enum([
    "quantity",
    "cash",
    "fee",
    "action",
    "date",
    "currency",
    "missing",
    "ambiguous",
  ]),
  subject: z.string(),
  expected: z.string().nullable(),
  observed: z.string().nullable(),
  sourceRef: z.string(),
  candidateIds: z.array(z.string()),
  reason: z.string(),
});
export const reconciliationRunSchema = z.strictObject({
  id: z.string(),
  revision: z.literal(1),
  createdAt: z.iso.datetime(),
  portfolioId: z.string(),
  request: reconciliationRequestSchema,
  statement: statementSnapshotSchema,
  book: bookStateSchema,
  expectedTrades: z.array(statementTradeSchema),
  matchedFillIds: z.array(z.string()),
  breaks: z.array(reconciliationBreakSchema),
  status: z.enum(["matched", "breaks"]),
  warnings: z.array(z.string()),
  policyVersion: z.literal("chapter-13.v1"),
});
export type ReconciliationRun = z.infer<typeof reconciliationRunSchema>;
export const resolutionRequestSchema = z.strictObject({
  runId: z.string().min(1),
  breakId: z.string().min(1),
  owner: z.string().trim().min(2).max(80),
  reason: z.string().trim().min(10).max(500),
  evidenceRef: z.string().trim().min(3).max(200),
  correction: correctionRequestSchema.nullable().default(null),
});
export type ResolutionRequest = z.infer<typeof resolutionRequestSchema>;
export const resolutionSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  approvedAt: z.iso.datetime().nullable(),
  request: resolutionRequestSchema,
  portfolioId: z.string(),
  status: z.enum(["proposed", "approved_followup", "corrected_requires_reconciliation"]),
  journalEventIds: z.array(z.string()),
});
export type Resolution = z.infer<typeof resolutionSchema>;
