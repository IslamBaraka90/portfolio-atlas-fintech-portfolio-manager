import type { RiskModelRequest, RiskModelSnapshot } from "@portfolio-atlas/contracts";
import type { BenchmarkSource } from "./benchmark-engine.js";
export type RiskCalculation = Omit<RiskModelSnapshot, "id" | "revision" | "createdAt" | "request">;
export interface RiskEngine {
  calculate(request: RiskModelRequest, sources: BenchmarkSource[]): RiskCalculation;
}
