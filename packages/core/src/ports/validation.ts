import type { HistoricalFixture, ValidationRequest } from "@portfolio-atlas/contracts";
export interface HistoricalFixtureProvider {
  get(scenario: ValidationRequest["scenario"]): HistoricalFixture;
}
export interface DrawdownEngine {
  calculate(returns: number[]): { drawdowns: number[]; maximumDrawdown: number };
}
