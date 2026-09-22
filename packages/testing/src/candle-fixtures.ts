import type { BarObservation } from "@portfolio-atlas/contracts";
// A small authored session ledger, not a production exchange calendar.
export const lessonSessions = [
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-08",
  "2026-09-09",
  "2026-09-10",
  "2026-09-11",
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
];
export function lessonBars(symbol: string, adversarial = false): BarObservation[] {
  const rows = lessonSessions.map((date, index): BarObservation => {
    const close = 101 + index;
    return {
      rowId: "fixture-row-" + index,
      sourceIndex: index,
      symbol,
      timestamp: date + "T13:30:00.000Z",
      sessionDate: date,
      open: close - 1,
      high: close + 1,
      low: close - 2,
      close,
      volume: 1000 + 100 * index,
      adjustedClose: null,
      finality: "final",
      evidence: "Authored completed daily session in fixture calendar v1.",
    };
  });
  if (!adversarial) return rows;
  rows[1] = { ...rows[1]!, open: 100, high: 99, low: 98, close: 101 };
  rows[2]!.close = null;
  rows[3]!.volume = 0;
  rows[4]!.volume = -1;
  rows[5]!.volume = null;
  rows[6]!.finality = "incomplete";
  rows[7]!.symbol = "WRONG";
  rows[8]!.timestamp = "not-a-date";
  rows[9]!.timestamp = rows[10]!.timestamp;
  rows[9]!.sessionDate = rows[10]!.sessionDate;
  return rows;
}
