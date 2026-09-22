import { z } from "zod";
export const basisDriftReportSchema = z.strictObject({
  source: z.literal("synthetic"),
  scenario: z.string(),
  baselineObservedAt: z.iso.datetime(),
  candidateObservedAt: z.iso.datetime(),
  state: z.enum(["stable", "expected-restatement", "basis-drift"]),
  toleranceBps: z.number().nonnegative(),
  rows: z.array(
    z.strictObject({
      date: z.iso.date(),
      oldFactor: z.number(),
      newFactor: z.number(),
      expectedMultiplier: z.number(),
      residualBps: z.number(),
      state: z.string(),
    }),
  ),
  limitations: z.array(z.string()),
});
export type BasisDriftReport = z.infer<typeof basisDriftReportSchema>;
