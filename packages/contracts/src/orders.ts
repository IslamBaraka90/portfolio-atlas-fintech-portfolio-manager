import { z } from "zod";
import { rebalanceProposalSchema } from "./rebalancing.js";
import { moneyTextSchema, quantityTextSchema } from "./accounting.js";
import { snapshotRefSchema } from "./valuation.js";
export const orderStateSchema = z.enum([
  "submitted",
  "accepted",
  "partially_filled",
  "filled",
  "cancel_pending",
  "cancelled",
  "rejected",
]);
export const paperSubmitSchema = z.strictObject({
  proposal: snapshotRefSchema,
  clientBatchId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  orderType: z.enum(["market", "limit"]).default("market"),
});
export type PaperSubmit = z.infer<typeof paperSubmitSchema>;
export const paperEventSchema = z
  .strictObject({
    eventId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
    expectedRevision: z.number().int().positive(),
    orderId: z.string().min(1),
    kind: z.enum(["accept", "opening", "cancel_request", "cancel_ack", "reject"]),
    opening: z
      .strictObject({
        at: z.iso.datetime(),
        price: quantityTextSchema.refine((v) => Number(v) > 0),
        capacity: z.number().int().min(0).max(1000000),
      })
      .nullable()
      .default(null),
    reason: z.string().trim().max(300).default(""),
  })
  .superRefine((v, c) => {
    if ((v.kind === "opening") !== (v.opening !== null))
      c.addIssue({
        code: "custom",
        message: "Only an opening event requires opening evidence.",
        path: ["opening"],
      });
  });
export type PaperEvent = z.infer<typeof paperEventSchema>;
export const paperFillSchema = z.strictObject({
  id: z.string(),
  eventId: z.string(),
  at: z.iso.datetime(),
  recordedAt: z.iso.datetime(),
  quantity: quantityTextSchema,
  price: quantityTextSchema,
  notional: moneyTextSchema,
  fee: moneyTextSchema,
  ledgerEventId: z.string(),
  source: z.literal("authored_paper_opening_event"),
  settlementPolicy: z.literal("immediate_teaching"),
});
export type PaperFill = z.infer<typeof paperFillSchema>;
export const paperOrderSchema = z.strictObject({
  id: z.string(),
  clientOrderId: z.string(),
  tradeIndex: z.number().int().nonnegative(),
  instrumentId: z.string(),
  instrumentRevision: z.number().int().positive(),
  side: z.enum(["buy", "sell"]),
  orderType: z.enum(["market", "limit"]),
  quantity: quantityTextSchema,
  protectionPrice: quantityTextSchema,
  lotSize: z.number().int().positive(),
  tickSize: z.number().positive(),
  state: orderStateSchema,
  submittedAt: z.iso.datetime(),
  acceptedAt: z.iso.datetime().nullable(),
  lastOpeningAt: z.iso.datetime().nullable().default(null),
  filledQuantity: quantityTextSchema,
  remainingQuantity: quantityTextSchema,
  filledNotional: moneyTextSchema,
  fees: moneyTextSchema,
  averagePrice: z.number().finite().nullable(),
  cashReserved: moneyTextSchema,
  reservationId: z.string().nullable(),
  sharesCommitted: quantityTextSchema,
  fills: z.array(paperFillSchema),
  checks: z.array(z.string()),
  history: z.array(
    z.strictObject({
      eventId: z.string(),
      at: z.iso.datetime(),
      kind: z.string(),
      state: orderStateSchema,
      reason: z.string(),
    }),
  ),
});
export type PaperOrder = z.infer<typeof paperOrderSchema>;
export const paperBatchSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  clientBatchId: z.string(),
  portfolioId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  proposal: rebalanceProposalSchema,
  expectedBookCheckpoint: z.number().int().nonnegative(),
  status: z.enum(["active", "complete"]),
  orders: z.array(paperOrderSchema),
  warnings: z.array(z.string()),
  policyVersion: z.literal("chapter-12.v1"),
  packageVersion: z.literal("0.13.2"),
});
export type PaperBatch = z.infer<typeof paperBatchSchema>;
