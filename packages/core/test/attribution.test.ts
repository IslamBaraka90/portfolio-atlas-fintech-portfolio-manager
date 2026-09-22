import assert from "node:assert/strict";
import test from "node:test";
import { attributionRequestSchema } from "@portfolio-atlas/contracts";
import { brinsonFachler } from "../src/domain/attribution/brinson-fachler.js";
test("authored Brinson-Fachler components reconcile 1.3 percentage points of active return", () => {
  const input = attributionRequestSchema.parse({
    name: "Sector example",
    source: "authored_sector_example",
    sourceRef: "independent-two-sector-case",
    from: "2026-01-01",
    to: "2026-01-31",
    currency: "USD",
    benchmarkLabel: "Authored 50/50 benchmark",
    sectors: [
      {
        sector: "TECHNOLOGY",
        portfolioWeight: 0.6,
        benchmarkWeight: 0.5,
        portfolioReturn: 0.12,
        benchmarkReturn: 0.1,
      },
      {
        sector: "HEALTHCARE",
        portfolioWeight: 0.4,
        benchmarkWeight: 0.5,
        portfolioReturn: 0.04,
        benchmarkReturn: 0.05,
      },
    ],
  });
  const result = brinsonFachler(input, null);
  for (const [actual, expected] of [
    [result.portfolioReturn, 0.088],
    [result.benchmarkReturn, 0.075],
    [result.activeReturn, 0.013],
    [result.allocation, 0.005],
    [result.selection, 0.005],
    [result.interaction, 0.003],
    [result.residual, 0],
  ])
    assert.ok(Math.abs(actual! - expected!) < 1e-12);
  assert.equal(result.reconciled, true);
  assert.equal(result.linkage, "standalone_example");
  assert.throws(() =>
    attributionRequestSchema.parse({
      ...input,
      sectors: [{ ...input.sectors[0], portfolioWeight: 1.1 }],
    }),
  );
});
