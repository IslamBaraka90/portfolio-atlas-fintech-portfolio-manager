import type { CompanyPeriod, CompanyRequest, Instrument } from "@portfolio-atlas/contracts";
import type { CompanyProvider, Clock, CompanyFacts, ProviderReply } from "@portfolio-atlas/core";
export class SyntheticCompanyProvider implements CompanyProvider {
  constructor(private readonly clock: Clock) {}
  async fetch(
    instrument: Instrument,
    request: CompanyRequest,
  ): Promise<ProviderReply<CompanyFacts>> {
    const annual = request.frequency === "annual",
      dates = annual ? ["2024-12-31", "2025-12-31"] : ["2025-09-30", "2025-12-31"];
    const periods: CompanyPeriod[] = dates.map((periodEnd, index) => ({
      periodEnd,
      periodType: annual ? "12M" : "3M",
      revision: 1,
      currency: instrument.quoteUnit.currency,
      availableAt:
        index === 0
          ? annual
            ? "2025-03-15T12:00:00Z"
            : "2025-11-15T12:00:00Z"
          : "2026-03-15T12:00:00Z",
      availabilityBasis: "authored_release",
      sourceRef: "authored-company.v1:" + periodEnd,
      items: {
        revenue: index === 0 ? 1000 : 1200,
        costOfRevenue: index === 0 ? 600 : 720,
        grossProfit: index === 0 ? 400 : 480,
        netIncome: index === 0 ? 100 : 180,
      },
      reasons: [],
    }));
    if (request.scenario === "missing") periods[1]!.items.netIncome = null;
    if (request.scenario === "zero-revenue") periods[1]!.items.revenue = 0;
    if (request.scenario === "late-revision")
      periods.push({
        ...structuredClone(periods[1]!),
        revision: 2,
        availableAt: "2026-09-20T12:00:00Z",
        sourceRef: "authored-company-correction.v2",
        items: { ...periods[1]!.items, netIncome: 150 },
      });
    const selected =
      instrument.assetType === "equity"
        ? periods.filter((p) => p.periodEnd >= request.from && p.periodEnd < request.to)
        : [];
    return {
      status: "available",
      source: "synthetic",
      observedAt: this.clock.now(),
      cache: "fresh",
      data: {
        periods: selected,
        warnings: [
          "Fictional company statements and release times for teaching.",
          ...(instrument.assetType !== "equity"
            ? ["Company income statements are unavailable for this instrument type."]
            : []),
        ],
        raw: { fixture: "company-income.v1", request, periods: selected },
      },
    };
  }
}
