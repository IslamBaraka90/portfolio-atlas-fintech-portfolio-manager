import type { CandidateAllocation, MandateInput } from "@portfolio-atlas/contracts";

// Every instrument in this fixture is invented. These are policy examples, not market data.
export const demoMandate: MandateInput = {
  name: "Atlas learning portfolio",
  objective: "Learn disciplined allocation while keeping a cash reserve.",
  baseCurrency: "USD",
  horizonYears: 5,
  minCashWeight: 0.1,
  maxCashWeight: 0.3,
  maxPositionWeight: 0.4,
  maxSectorWeight: 0.5,
  allowedAssetTypes: ["equity", "etf"],
  restrictedInstrumentIds: ["DEMO-RESTRICTED"],
};
export const fixtureTime = "2026-09-22T10:00:00.000Z";
export const balancedAllocation: CandidateAllocation = {
  asOf: fixtureTime,
  cashWeight: 0.1,
  positions: [
    {
      instrumentId: "DEMO-AURORA",
      name: "Aurora Systems",
      assetType: "equity",
      sector: "TECHNOLOGY",
      weight: 0.4,
    },
    {
      instrumentId: "DEMO-HARBOR",
      name: "Harbor Health",
      assetType: "equity",
      sector: "HEALTHCARE",
      weight: 0.3,
    },
    {
      instrumentId: "DEMO-INDEX",
      name: "Atlas Broad ETF",
      assetType: "etf",
      sector: "DIVERSIFIED FUND",
      weight: 0.2,
    },
  ],
};
export const concentratedAllocation: CandidateAllocation = {
  ...balancedAllocation,
  positions: balancedAllocation.positions.map((position, index) => ({
    ...position,
    weight: [0.6, 0.2, 0.1][index]!,
  })),
};
