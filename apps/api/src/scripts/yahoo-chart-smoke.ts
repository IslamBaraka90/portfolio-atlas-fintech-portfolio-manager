import {
  createYahooTransport,
  YahooInstrumentProvider,
  YahooChartProvider,
  RequestBudget,
  FileRawArchive,
  FintechMarketQualityValidator,
} from "@portfolio-atlas/adapters";
import { instrumentSchema } from "@portfolio-atlas/contracts";
import { fileURLToPath } from "node:url";
if (process.env.YAHOO_ENABLED !== "true") {
  console.error("Opt in with YAHOO_ENABLED=true. This command makes live Yahoo requests.");
  process.exitCode = 2;
} else {
  const clock = { now: () => new Date().toISOString() },
    transport = createYahooTransport(),
    budget = new RequestBudget(1, 20_000);
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
    const request = {
      instrumentId: instrument.instrumentId,
      instrumentRevision: 1,
      from: "2026-09-01",
      to: "2026-09-18",
      scenario: "clean" as const,
    };
    const result = await new YahooChartProvider(transport, clock, budget, 0).chart(
      instrument,
      request,
    );
    if (result.status === "unavailable") {
      console.log(JSON.stringify(result));
      process.exitCode = 1;
    } else {
      const archive = new FileRawArchive(
        fileURLToPath(new URL("../../../../.data/market-data/", import.meta.url)),
      );
      const evidence = await archive.save(result.data.raw);
      const quality = new FintechMarketQualityValidator().validate(
        result.data,
        instrument,
        request,
        result.observedAt,
      );
      console.log(
        JSON.stringify({
          operation: "chart",
          mode: "yahoo",
          observedAt: result.observedAt,
          status: result.status,
          requestedSymbol: instrument.returnedSymbol,
          returnedSymbol: result.data.symbol,
          window: request,
          rows: result.data.rows.length,
          firstTimestamp: result.data.rows[0]?.timestamp,
          lastTimestamp: result.data.rows.at(-1)?.timestamp,
          basis: result.data.basis,
          unit: result.data.quoteUnit,
          sourceHash: evidence.hash,
          accepted: quality.acceptedIndexes.length,
          quarantined: quality.quarantinedIndexes.length,
          reasonCodes: [...new Set(quality.rows.flatMap((row) => row.findings.map((f) => f.code)))],
        }),
      );
    }
  }
}
