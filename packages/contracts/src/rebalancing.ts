import { z } from "zod";
import { snapshotRefSchema, priceOverrideSchema, valuationSnapshotSchema } from "./valuation.js";
import { targetSnapshotSchema, constraintSlackSchema } from "./construction.js";
import { moneyTextSchema, quantityTextSchema, bookSnapshotSchema } from "./accounting.js";
export const rebalanceRequestSchema = z
  .strictObject({
    target: snapshotRefSchema,
    valuation: snapshotRefSchema,
    trigger: z.enum(["manual", "calendar", "drift", "cash_flow"]).default("manual"),
    dueAt: z.iso.datetime().nullable().default(null),
    driftThreshold: z.number().min(0).max(1).default(0.05),
    minTrade: moneyTextSchema.default("10.00"),
    feeBps: z.number().min(0).max(500).default(10),
    newPrices: z.array(priceOverrideSchema).max(8).default([]),
    illustrativeCoefficient: z.number().min(0).max(1).default(0.2),
  })
  .superRefine((r, c) => {
    if (r.trigger === "calendar" && !r.dueAt)
      c.addIssue({
        code: "custom",
        message: "Calendar trigger requires a due time.",
        path: ["dueAt"],
      });
    if (new Set(r.newPrices.map((p) => p.instrumentId)).size !== r.newPrices.length)
      c.addIssue({
        code: "custom",
        message: "Choose one new price per instrument.",
        path: ["newPrices"],
      });
  });
export type RebalanceRequest = z.infer<typeof rebalanceRequestSchema>;
export const lotSaleSchema = z.strictObject({
  lotId: z.string(),
  quantity: quantityTextSchema,
  basisRemoved: moneyTextSchema,
  grossProceeds: moneyTextSchema,
  gain: z.string(),
});
export type LotSale = z.infer<typeof lotSaleSchema>;
export const lotScorePreviewSchema = z.strictObject({
  status: z.enum(["available", "unavailable"]),
  reason: z.string(),
  coefficient: z.number(),
  oldestFirst: z.record(z.string(), z.unknown()).nullable(),
  lowestScore: z.record(z.string(), z.unknown()).nullable(),
  packageVersion: z.literal("0.13.2"),
  tier: z.literal("contract"),
  affectsCash: z.literal(false),
  changesBookLots: z.literal(false),
});
export type LotScorePreview = z.infer<typeof lotScorePreviewSchema>;
export const proposedTradeSchema = z.strictObject({
  instrumentId: z.string(),
  instrumentRevision: z.number().int().positive(),
  side: z.enum(["buy", "sell"]),
  quantity: quantityTextSchema,
  price: quantityTextSchema,
  notional: moneyTextSchema,
  fee: moneyTextSchema,
  reason: z.string(),
  lots: z.array(lotSaleSchema),
  lotScore: lotScorePreviewSchema.nullable(),
});
export type ProposedTrade = z.infer<typeof proposedTradeSchema>;
export const rebalanceProposalSchema = z.strictObject({
  id: z.string(),
  revision: z.number().int().positive(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  portfolioId: z.string(),
  request: rebalanceRequestSchema,
  target: targetSnapshotSchema,
  valuation: valuationSnapshotSchema,
  status: z.enum(["ready", "no_trade", "rejected", "approved"]),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  triggered: z.boolean(),
  trades: z.array(proposedTradeSchema),
  projectedBook: bookSnapshotSchema,
  cashBridge: z.strictObject({
    opening: moneyTextSchema,
    sales: moneyTextSchema,
    purchases: moneyTextSchema,
    fees: moneyTextSchema,
    closing: moneyTextSchema,
    reserved: moneyTextSchema,
    available: moneyTextSchema,
  }),
  startingNav: moneyTextSchema,
  projectedNav: moneyTextSchema,
  allocations: z.array(
    z.strictObject({
      instrumentId: z.string(),
      price: quantityTextSchema,
      beforeQuantity: quantityTextSchema,
      afterQuantity: quantityTextSchema,
      currentWeight: z.number(),
      targetWeight: z.number(),
      projectedWeight: z.number(),
      residualDrift: z.number(),
    }),
  ),
  cashWeight: z.number(),
  constraints: z.array(constraintSlackSchema),
  approvedAt: z.iso.datetime().nullable(),
  policyVersion: z.literal("chapter-11.v1"),
  createsOrders: z.literal(false),
});
export type RebalanceProposal = z.infer<typeof rebalanceProposalSchema>;
export const proposalApprovalSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
});
