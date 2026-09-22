import { z } from "zod";
import {
  corporateActionSchema,
  type CorporateAction,
  type MarketDataset,
} from "@portfolio-atlas/contracts";
import type { ActionNormalizer } from "@portfolio-atlas/core";
export class ProviderActionNormalizer implements ActionNormalizer {
  normalize(dataset: MarketDataset, raw: unknown) {
    if (dataset.source === "synthetic") {
      const parsed = z.object({ actions: z.array(corporateActionSchema).optional() }).parse(raw);
      return {
        actions: parsed.actions ?? [],
        warnings: ["Authored synthetic action revisions; no real issuer evidence is claimed."],
      };
    }
    const root = z
      .object({
        events: z
          .object({
            dividends: z.array(z.unknown()).optional(),
            splits: z.array(z.unknown()).optional(),
          })
          .optional(),
      })
      .parse(raw);
    const actions: CorporateAction[] = [];
    const map = (value: unknown, index: number, kind: "split" | "cash_dividend") => {
      const record = z.record(z.string(), z.unknown()).safeParse(value);
      const row = record.success ? record.data : {};
      const date = z.iso.datetime().safeParse(row.date);
      let effectiveDate: string | null = null;
      if (date.success && dataset.timezone) {
        try {
          effectiveDate = new Intl.DateTimeFormat("en-CA", {
            timeZone: dataset.timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(date.data));
        } catch {
          /* Unknown timezone remains unresolved. */
        }
      }
      const numerator = z.number().positive().safeParse(row.numerator),
        denominator = z.number().positive().safeParse(row.denominator);
      const amount = z.number().positive().safeParse(row.amount);
      const ratio =
        numerator.success && denominator.success ? numerator.data / denominator.data : null;
      actions.push(
        corporateActionSchema.parse({
          id:
            dataset.instrument.instrumentId + ":" + kind + ":" + (effectiveDate ?? "row-" + index),
          revision: 1,
          instrumentId: dataset.instrument.instrumentId,
          kind,
          status: "candidate",
          effectiveDate,
          availableAt: dataset.observedAt,
          observedAt: dataset.observedAt,
          source: "yahoo",
          sourceRef: "sha256:" + dataset.sourceHash,
          ratio: kind === "split" && ratio !== null && Number.isFinite(ratio) ? ratio : null,
          amount: kind === "cash_dividend" && amount.success ? amount.data : null,
          currency: null,
          reasons: [
            "Provider observation needs issuer/exchange confirmation.",
            "Historical announcement and record/payment dates are not established.",
            ...(kind === "cash_dividend"
              ? [
                  "Dividend currency and ordinary/special classification require independent evidence.",
                ]
              : []),
            ...(effectiveDate === null ? ["Effective date could not be established."] : []),
          ],
        }),
      );
    };
    root.events?.splits?.forEach((row, index) => map(row, index, "split"));
    root.events?.dividends?.forEach((row, index) => map(row, index, "cash_dividend"));
    return {
      actions,
      warnings: [
        "Yahoo events are candidates only. This review cannot post cash, change shares, or certify adjustment basis.",
      ],
    };
  }
}
