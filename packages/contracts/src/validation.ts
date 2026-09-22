import { z } from "zod";
import { instrumentSchema } from "./instruments.js";
import { bookStateSchema, moneyTextSchema } from "./accounting.js";
import { snapshotRefSchema } from "./valuation.js";
export const validationRequestSchema = z.strictObject({
  scenario: z.enum(["clean", "late-filing", "missing-session", "delisted"]).default("clean"),
  window: z.enum(["expanding", "rolling"]).default("expanding"),
  feeBps: z.number().min(0).max(500).default(10),
  dataset: snapshotRefSchema.nullable().default(null),
  seed: z.literal(0).default(0),
});
export type ValidationRequest = z.infer<typeof validationRequestSchema>;
export const historicalFixtureSchema = z.strictObject({
  id: z.string(),
  revision: z.literal(1),
  expectedSessions: z.array(z.string()),
  instruments: z.array(instrumentSchema).length(2),
  bars: z.array(
    z.strictObject({
      session: z.string(),
      openAt: z.iso.datetime(),
      closeAt: z.iso.datetime(),
      availableAt: z.iso.datetime(),
      opens: z.array(z.number().positive().max(1000000)).length(2),
      closes: z.array(z.number().positive().max(1000000)).length(2),
    }),
  ),
  membership: z.array(
    z.strictObject({
      instrumentId: z.string(),
      from: z.iso.datetime(),
      to: z.iso.datetime().nullable(),
      availableAt: z.iso.datetime(),
      recoveryPrice: z.number().positive().nullable(),
    }),
  ),
  filings: z.array(
    z.strictObject({
      instrumentId: z.string(),
      availableAt: z.iso.datetime(),
      sourceRef: z.string(),
    }),
  ),
  source: z.literal("authored_historical_teaching_fixture"),
});
export type HistoricalFixture = z.infer<typeof historicalFixtureSchema>;
export const validationFoldSchema = z.strictObject({
  name: z.string(),
  holdout: z.boolean(),
  trainStart: z.string(),
  trainEnd: z.string(),
  testStart: z.string(),
  testEnd: z.string(),
  decisionAt: z.iso.datetime(),
  fittedScores: z.array(z.strictObject({ instrumentId: z.string(), score: z.number().finite() })),
  selectedIds: z.array(z.string()),
  policy: z.enum(["momentum", "equal_baseline"]),
  feeBps: z.number(),
  timeline: z.array(
    z.strictObject({
      kind: z.enum(["decision", "fill", "forced_exit", "valuation"]),
      at: z.iso.datetime(),
      detail: z.string(),
    }),
  ),
  equity: z.array(
    z.strictObject({ at: z.iso.datetime(), nav: moneyTextSchema, drawdown: z.number().finite() }),
  ),
  returnFraction: z.number().finite(),
  maximumDrawdown: z.number().finite(),
  fees: moneyTextSchema,
  book: bookStateSchema,
});
export type ValidationFold = z.infer<typeof validationFoldSchema>;
export const validationRunSchema = z.strictObject({
  id: z.string(),
  revision: z.literal(1),
  createdAt: z.iso.datetime(),
  request: validationRequestSchema,
  fixture: historicalFixtureSchema,
  status: z.enum(["synthetic_experiment", "blocked"]),
  reasons: z.array(z.string()),
  warnings: z.array(z.string()),
  folds: z.array(validationFoldSchema),
  policyVersion: z.literal("chapter-10.v1"),
  packageVersion: z.literal("0.13.2"),
});
export type ValidationRun = z.infer<typeof validationRunSchema>;
