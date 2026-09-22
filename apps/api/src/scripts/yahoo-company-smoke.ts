import {
  createYahooTransport,
  YahooInstrumentProvider,
  YahooCompanyProvider,
  RequestBudget,
  FileRawArchive,
} from "@portfolio-atlas/adapters";
import { instrumentSchema, companyRequestSchema } from "@portfolio-atlas/contracts";
import { fileURLToPath } from "node:url";
if (process.env.YAHOO_ENABLED !== "true") {
  console.error("Opt in with YAHOO_ENABLED=true. This command makes live Yahoo requests.");
  process.exitCode = 2;
} else {
  const clock = { now: () => new Date().toISOString() },
    transport = createYahooTransport(),
    budget = new RequestBudget(1, 20000);
  const quote = await new YahooInstrumentProvider(transport, clock, budget, 0).observe("AAPL");
  if (quote.status === "unavailable") {
    console.log(JSON.stringify(quote));
    process.exitCode = 1;
  } else {
    const { verifiedIdentity, ...observation } = quote.data;
    void verifiedIdentity;
    const instrument = instrumentSchema.parse({
      ...observation,
      instrumentId: "live-smoke-AAPL",
      listingId: "unverified-AAPL",
      issuerId: null,
      aliases: [],
      revision: 1,
    });
    const request = companyRequestSchema.parse({
      instrumentId: instrument.instrumentId,
      instrumentRevision: 1,
      from: "2023-01-01",
      to: "2026-09-22",
      frequency: "annual",
    });
    const result = await new YahooCompanyProvider(transport, clock, budget).fetch(
      instrument,
      request,
    );
    if (result.status === "unavailable") {
      console.log(JSON.stringify(result));
      process.exitCode = 1;
    } else {
      const archive = new FileRawArchive(
        fileURLToPath(new URL("../../../../.data/company-facts/", import.meta.url)),
      );
      const evidence = await archive.save(result.data.raw);
      console.log(
        JSON.stringify({
          operation: "fundamentalsTimeSeries",
          mode: "yahoo",
          observedAt: result.observedAt,
          sourceHash: evidence.hash,
          periods: result.data.periods.map((p) => ({
            periodEnd: p.periodEnd,
            periodType: p.periodType,
            currency: p.currency,
            availableAt: p.availableAt,
            availabilityBasis: p.availabilityBasis,
            missingFields: Object.entries(p.items)
              .filter(([, v]) => v === null)
              .map(([k]) => k),
            reasons: p.reasons,
          })),
          warnings: result.data.warnings,
        }),
      );
    }
  }
}
