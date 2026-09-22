import {
  createYahooTransport,
  YahooInstrumentProvider,
  RequestBudget,
} from "@portfolio-atlas/adapters";

if (process.env.YAHOO_ENABLED !== "true") {
  console.error("Opt in with YAHOO_ENABLED=true. This command makes live Yahoo requests.");
  process.exitCode = 2;
} else {
  const provider = new YahooInstrumentProvider(
    createYahooTransport(),
    { now: () => new Date().toISOString() },
    new RequestBudget(1, 15_000),
    0,
  );
  const search = await provider.search("AAPL");
  console.log(
    JSON.stringify({
      operation: "search",
      mode: "yahoo",
      observedAt: search.observedAt,
      status: search.status,
      ...(search.status === "available"
        ? {
            candidateCount: search.data.length,
            symbols: search.data.map((row) => row.providerSymbol),
          }
        : { failure: search.failure }),
    }),
  );
  if (search.status === "available") {
    const quote = await provider.observe("AAPL");
    console.log(
      JSON.stringify({
        operation: "quote",
        mode: "yahoo",
        observedAt: quote.observedAt,
        status: quote.status,
        ...(quote.status === "available"
          ? {
              requestedSymbol: quote.data.requestedSymbol,
              returnedSymbol: quote.data.returnedSymbol,
              unit: quote.data.quoteUnit,
              tickSize: quote.data.tickSize,
              identityStatus: quote.data.identityStatus,
            }
          : { failure: quote.failure }),
      }),
    );
  }
}
