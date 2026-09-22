import { historicalFixtureSchema, type ValidationRequest } from "@portfolio-atlas/contracts";
import { syntheticInstruments } from "./instrument-fixtures.js";
export function historicalFixture(scenario: ValidationRequest["scenario"] = "clean") {
  const dates = [
    "01",
    "02",
    "03",
    "06",
    "07",
    "08",
    "09",
    "10",
    "13",
    "14",
    "15",
    "16",
    "17",
    "20",
    "21",
    "22",
  ].map((d) => "2026-07-" + d);
  const a = [100, 102, 104, 106, 108, 110, 105, 112, 114, 116, 118, 120, 121, 119, 124, 125];
  const b = [100, 99, 101, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112];
  const known = "2026-06-30T00:00:00Z";
  const instruments = [syntheticInstruments[0]!, syntheticInstruments[2]!].map((i) => ({
    ...i,
    observedAt: known,
    quoteTime: known,
  }));
  const bars = dates.map((session, i) => ({
    session,
    openAt: session + "T13:30:00Z",
    closeAt: session + "T20:00:00Z",
    availableAt: session + "T20:00:00Z",
    opens: [i === 0 ? 100 : a[i - 1]! + 1, i === 0 ? 100 : b[i - 1]!],
    closes: [a[i]!, b[i]!],
  }));
  if (scenario === "delisted") {
    for (const bar of bars.slice(6)) {
      bar.opens[0] = 5;
      bar.closes[0] = 5;
    }
  }
  return historicalFixtureSchema.parse({
    id: "historical-v1-" + scenario,
    revision: 1,
    expectedSessions: dates,
    instruments,
    bars: scenario === "missing-session" ? bars.filter((_, i) => i !== 6) : bars,
    membership: instruments.map((i, index) => ({
      instrumentId: i.instrumentId,
      from: known,
      to: scenario === "delisted" && index === 0 ? bars[6]!.openAt : null,
      availableAt: known,
      recoveryPrice: scenario === "delisted" && index === 0 ? 5 : null,
    })),
    filings: instruments.map((i) => ({
      instrumentId: i.instrumentId,
      availableAt: scenario === "late-filing" ? "2026-08-01T00:00:00Z" : known,
      sourceRef: "authored-filing-v1-" + i.instrumentId,
    })),
    source: "authored_historical_teaching_fixture",
  });
}
