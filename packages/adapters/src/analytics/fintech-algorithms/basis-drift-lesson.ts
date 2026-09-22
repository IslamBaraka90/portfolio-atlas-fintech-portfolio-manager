import { detectAdjustmentBasisDrift } from "fintech-algorithms/market-data-engineering/data-quality/provider-adjustment-basis-drift-detector";
import { basisDriftReportSchema } from "@portfolio-atlas/contracts";
// These two authored archived snapshots make an independent 1% residual visible.
// They are not Yahoo evidence and do not certify any live provider's price basis.
export function basisDriftLesson() {
  const result = detectAdjustmentBasisDrift({
    provider: "authored-fixture",
    dataset: "split-factor-archive.v1",
    instrument_id: "DEMO-AURORA",
    price_field: "close",
    basis_id: "synthetic-split-adjusted.v1",
    baseline_observed_at: "2026-09-02T20:00:00Z",
    candidate_observed_at: "2026-09-04T20:00:00Z",
    tolerance_bps: 1,
    baseline_rows: [
      { date: "2026-09-01", raw_price: 100, adjusted_price: 100 },
      { date: "2026-09-02", raw_price: 102, adjusted_price: 102 },
    ],
    candidate_rows: [
      { date: "2026-09-01", raw_price: 100, adjusted_price: 50 },
      { date: "2026-09-02", raw_price: 102, adjusted_price: 51.51 },
    ],
    actions: [
      {
        event_id: "authored-split-2for1",
        effective_date: "2026-09-03",
        available_at: "2026-09-02T21:00:00Z",
        status: "confirmed",
        adjustment_multiplier: 0.5,
      },
    ],
  });
  return basisDriftReportSchema.parse({
    source: "synthetic",
    scenario: "One explained split restatement and one unexplained 1% residual.",
    baselineObservedAt: result.baseline_observed_at,
    candidateObservedAt: result.candidate_observed_at,
    state: result.state,
    toleranceBps: result.tolerance_bps,
    rows: result.rows.map((row) => ({
      date: row.date,
      oldFactor: row.old_factor,
      newFactor: row.new_factor,
      expectedMultiplier: row.expected_multiplier,
      residualBps: row.residual_bps,
      state: row.state,
    })),
    limitations: [
      "Authored paired snapshots; no live provider basis certification.",
      "Residual = absolute log(observed multiplier / expected multiplier) × 10,000.",
      "Only independently evidenced action factors may explain a restatement.",
    ],
  });
}
