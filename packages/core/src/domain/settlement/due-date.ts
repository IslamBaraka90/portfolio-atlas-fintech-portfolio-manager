import type { SettlementPolicy } from "@portfolio-atlas/contracts";
import { ApplicationError } from "../../use-cases/errors.js";
export function settlementDueDate(tradeDate: string, policy: SettlementPolicy): string {
  if (tradeDate < policy.from || tradeDate > policy.to)
    throw new ApplicationError(
      "INVALID_SNAPSHOT",
      "Trade date is outside the authored calendar coverage.",
    );
  const business = (date: string) =>
    policy.businessWeekdays.includes(new Date(date + "T00:00:00Z").getUTCDay()) &&
    !policy.holidays.includes(date);
  const next = (date: string) =>
    new Date(Date.parse(date + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  let date = tradeDate,
    remaining = policy.lagBusinessDays;
  for (let steps = 0; steps <= 366; steps++) {
    if (date > policy.to) break;
    if (business(date)) {
      if (remaining === 0) return date;
      remaining--;
    }
    date = next(date);
  }
  throw new ApplicationError(
    "INVALID_SNAPSHOT",
    "Calendar coverage cannot establish this settlement date.",
  );
}
