import type { CorporateAction } from "@portfolio-atlas/contracts";
import { lessonBars } from "./candle-fixtures.js";
export function actionLessonBars(symbol: string) {
  const closes = [100, 102, 51, 52, 50, 51, 52, 53, 54, 55, 56, 57];
  return lessonBars(symbol).map((row, index) => ({
    ...row,
    open: closes[index]! - 0.5,
    high: closes[index]! + 1,
    low: closes[index]! - 1,
    close: closes[index]!,
    volume: index < 2 ? 1000 : 2000,
    evidence: "Authored split/dividend fixture: completed daily session.",
  }));
}
export function actionLessonTimeline(
  instrumentId: string,
  currency: string | null,
  observedAt: string,
): CorporateAction[] {
  const common = {
    instrumentId,
    observedAt,
    source: "synthetic" as const,
    sourceRef: "fixture:split-dividend.v1",
    reasons: [],
  };
  const dividend: CorporateAction = {
    ...common,
    id: instrumentId + ":dividend-2026-09-08",
    revision: 1,
    kind: "cash_dividend",
    status: "confirmed",
    effectiveDate: "2026-09-08",
    availableAt: "2026-09-04T12:00:00Z",
    ratio: null,
    amount: 2,
    currency,
  };
  return [
    {
      ...common,
      id: instrumentId + ":split-2026-09-03",
      revision: 1,
      kind: "split",
      status: "confirmed",
      effectiveDate: "2026-09-03",
      availableAt: "2026-08-25T12:00:00Z",
      ratio: 2,
      amount: null,
      currency: null,
    },
    dividend,
    { ...dividend, revision: 2, amount: 2.5, availableAt: "2026-09-15T12:00:00Z" },
    {
      ...dividend,
      revision: 3,
      status: "cancelled",
      amount: 2.5,
      availableAt: "2026-09-20T12:00:00Z",
    },
  ];
}
