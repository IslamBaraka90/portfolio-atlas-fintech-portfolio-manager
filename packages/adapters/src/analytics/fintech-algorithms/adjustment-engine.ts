import { calculate as backwardSplit } from "fintech-algorithms/corporate-actions-and-security-master-data/adjustment-factors/backward-split-adjustment";
import { calculate as dividendAdjustment } from "fintech-algorithms/corporate-actions-and-security-master-data/adjustment-factors/cash-dividend-total-return-adjustment";
import { z } from "zod";
import type {
  ActionReview,
  AdjustmentRequest,
  AdjustmentResult,
  FxObservation,
  MarketDataset,
} from "@portfolio-atlas/contracts";
import { convertFx, selectActions, type AdjustmentEngine } from "@portfolio-atlas/core";
const dividendResult = z.object({
  adjustedPrices: z.array(z.number().positive()),
  cumulativeFactors: z.array(z.number().positive()),
});
export class FintechAdjustmentEngine implements AdjustmentEngine {
  calculate(
    dataset: MarketDataset,
    review: ActionReview,
    input: AdjustmentRequest,
    createdAt: string,
  ) {
    const selection = selectActions(review.actions, input.actionKnowledgeAt);
    const reasons: string[] = [];
    const warnings = [
      "Current-price research with an action knowledge cutoff is not a historical backtest.",
      "Dividend effects are embedded in total-return prices. Never add a second dividend cash credit to those returns.",
      "Converted prices use a constant authored FX scenario, not historical FX performance or executable quotes.",
      "Only one split followed by ordinary same-currency dividends is supported; no book entries are posted.",
    ];
    const base = {
      selectedActions: selection.selected,
      excludedActions: selection.excluded,
      fx: null as FxObservation | null,
      reasons,
      warnings,
    };
    if (dataset.basis !== "synthetic_unadjusted")
      reasons.push(
        "Provider price basis is not certified unadjusted; applying new factors could double-adjust it.",
      );
    if (
      dataset.quality.quarantinedIndexes.length ||
      dataset.quality.coverage.missingSessions.length ||
      dataset.quality.coverage.expectedSessions === null
    )
      reasons.push("A complete accepted session series is required. Gaps cannot be compressed.");
    if (dataset.rows.length < 2) reasons.push("At least two accepted prices are required.");
    const scale = dataset.quoteUnit.scaleToCurrency,
      currency = dataset.quoteUnit.currency;
    if (scale === null || currency === null)
      reasons.push("Price currency and unit scale must be established.");
    const first = dataset.rows[0]?.sessionDate ?? "",
      last = dataset.rows.at(-1)?.sessionDate ?? "";
    const applicable = selection.selected.filter((action) => {
      if (action.effectiveDate && (action.effectiveDate < first || action.effectiveDate > last)) {
        base.excludedActions.push({
          id: action.id,
          revision: action.revision,
          reason: "Effective date outside this research window",
        });
        return false;
      }
      return true;
    });
    base.selectedActions = applicable;
    for (const action of applicable) {
      if (action.instrumentId !== dataset.instrument.instrumentId)
        reasons.push("Action belongs to a different instrument.");
      if (action.status !== "confirmed" || !action.effectiveDate)
        reasons.push("Action " + action.id + " requires confirmed terms and an effective date.");
      if (action.kind === "unsupported")
        reasons.push("This action type has no specified adjustment method.");
    }
    const splits = applicable.filter((action) => action.kind === "split"),
      dividends = applicable.filter((action) => action.kind === "cash_dividend");
    if (splits.length > 1)
      reasons.push(
        "Multiple split chains need a separately specified rounding and share-basis policy.",
      );
    const split = splits[0];
    if (
      split &&
      (!split.ratio || split.ratio === 1 || dataset.rows.some((row) => row.volume === null))
    )
      reasons.push(
        "A non-unit split ratio and observed volumes are required by this package contract.",
      );
    for (const action of dividends) {
      if (!action.amount || action.currency !== currency)
        reasons.push("Dividend amount and same-currency authority are required.");
      if (split && action.effectiveDate! <= split.effectiveDate!)
        reasons.push("Dividend before/on the split needs an explicit share-basis ordering policy.");
    }
    for (const action of applicable)
      if (dataset.rows.findIndex((row) => row.sessionDate === action.effectiveDate) <= 0)
        reasons.push("Every event requires a matching session and an earlier close.");
    if (reasons.length) return { ...base, status: "unsupported" as const, series: [] };
    const rawPrices = dataset.rows.map((row) => row.close! * scale!);
    let splitPrices = [...rawPrices],
      volumes = dataset.rows.map((row) => row.volume),
      totalPrices = [...rawPrices],
      factors = rawPrices.map(() => 1);
    try {
      if (split) {
        const result = backwardSplit({
          prices: rawPrices,
          volumes: volumes as number[],
          eventIndex: dataset.rows.findIndex((row) => row.sessionDate === split.effectiveDate),
          postSplitSharesPerPreSplitShare: split.ratio!,
        });
        splitPrices = result.adjustedPrices;
        volumes = result.adjustedVolumes;
      }
      totalPrices = [...splitPrices];
      if (dividends.length) {
        const asOf =
          Date.parse(dataset.observedAt) > Date.parse(input.actionKnowledgeAt)
            ? dataset.observedAt
            : input.actionKnowledgeAt;
        const result = dividendResult.parse(
          dividendAdjustment({
            asOf,
            returnVariant: "gross",
            priceCurrency: currency,
            anchorBasis: "latest_raw_close",
            specialDistributionPolicy: "exclude",
            observations: dataset.rows.map((row, index) => ({
              date: row.sessionDate,
              close: splitPrices[index],
              availableAt: dataset.observedAt,
            })),
            eventRevisions: dividends.map((action) => ({
              eventId: action.id,
              revision: action.revision,
              status: action.status,
              classification: "ordinary",
              exDate: action.effectiveDate,
              grossDividend: action.amount,
              dividendCurrency: action.currency,
              withholdingRate: 0,
              fxRateToPriceCurrency: 1,
              fxObservedAt: null,
              availableAt: action.availableAt,
              sourceId: action.sourceRef,
            })),
          }),
        );
        if (
          result.adjustedPrices.length !== rawPrices.length ||
          result.cumulativeFactors.length !== rawPrices.length
        )
          throw new Error("Package output length changed.");
        totalPrices = result.adjustedPrices;
        factors = result.cumulativeFactors;
      }
    } catch (error) {
      reasons.push(
        "Adjustment contract refused this input: " +
          (error instanceof Error ? error.message : "unknown failure"),
      );
      return { ...base, status: "unsupported" as const, series: [] };
    }
    if (currency !== input.targetCurrency)
      base.fx = {
        id: "authored-usd-eur:" + createdAt,
        baseCurrency: "USD",
        quoteCurrency: "EUR",
        quotePerBase: 0.9,
        observedAt: createdAt,
        availableAt: createdAt,
        source: "Authored constant currency scenario; not a market quote.",
        maxAgeSeconds: 3600,
      };
    const series: AdjustmentResult["series"] = dataset.rows.map((row, index) => {
      let convertedClose: number | null = totalPrices[index]!;
      try {
        if (base.fx)
          convertedClose = convertFx(
            totalPrices[index]!,
            currency!,
            input.targetCurrency,
            base.fx,
            createdAt,
          );
      } catch (error) {
        convertedClose = null;
        const message = error instanceof Error ? error.message : "FX unavailable";
        if (!reasons.includes(message)) reasons.push(message);
      }
      return {
        date: row.sessionDate!,
        sourceRowId: row.rowId,
        providerClose: rawPrices[index]!,
        splitAdjustedClose: splitPrices[index]!,
        totalReturnClose: totalPrices[index]!,
        splitAdjustedVolume: volumes[index]!,
        convertedClose,
        splitFactor: splitPrices[index]! / rawPrices[index]!,
        dividendFactor: factors[index]!,
      };
    });
    return {
      ...base,
      status: reasons.length ? ("unsupported" as const) : ("ready" as const),
      series,
    };
  }
}
