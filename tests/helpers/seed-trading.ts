import {
  mandateSchema,
  portfolioSchema,
  valuationSnapshotSchema,
  searchResultSchema,
  resolveResultSchema,
  ingestionResultSchema,
  actionReviewSchema,
  adjustmentResultSchema,
  riskModelSnapshotSchema,
  targetSnapshotSchema,
  type Instrument,
} from "@portfolio-atlas/contracts";
import { demoMandate } from "@portfolio-atlas/testing";
export async function seedTrading(
  get: (path: string) => Promise<unknown>,
  post: (path: string, key: string, body: object) => Promise<unknown>,
  prefix: string,
  now: () => string,
) {
  const send = (path: string, key: string, body: object) => post(path, prefix + "-" + key, body);
  const mandate = mandateSchema.parse(await send("/mandates", "mandate", demoMandate));
  const portfolio = portfolioSchema.parse(
    await send("/portfolios", "portfolio", {
      name: "Rebalance and execution lesson",
      mandateId: mandate.id,
    }),
  );
  await send("/ledger/events", "deposit", {
    portfolioId: portfolio.id,
    kind: "deposit",
    occurredAt: "2026-09-01T00:00:00Z",
    currency: "USD",
    amount: "10000",
    sourceRef: prefix + "-capital",
  });
  const valuation = valuationSnapshotSchema.parse(
    await send("/valuations", "valuation", {
      portfolioId: portfolio.id,
      checkpoint: 1,
      asOf: now(),
      prices: [],
    }),
  );
  const instruments: Instrument[] = [],
    runs: { id: string; revision: number }[] = [];
  for (const symbol of ["AURA", "HARB"]) {
    const search = searchResultSchema.parse(await get("/instruments/search?q=" + symbol));
    const instrument = resolveResultSchema.parse(
      await send("/instruments/resolutions", "resolve-" + symbol, {
        candidateId: search.candidates[0]!.candidateId,
      }),
    ).instrument!;
    instruments.push(instrument);
    const dataset = ingestionResultSchema.parse(
      await send("/market-data/ingestions", "data-" + symbol, {
        instrumentId: instrument.instrumentId,
        instrumentRevision: instrument.revision,
        from: "2026-09-01",
        to: "2026-09-18",
        scenario: "clean",
      }),
    ).dataset!;
    const review = actionReviewSchema.parse(
      await send("/corporate-actions/reviews", "review-" + symbol, {
        datasetId: dataset.id,
        datasetRevision: dataset.revision,
      }),
    );
    const run = adjustmentResultSchema.parse(
      await send("/adjustment-runs", "adjust-" + symbol, {
        reviewId: review.id,
        actionKnowledgeAt: now(),
        targetCurrency: "USD",
      }),
    );
    runs.push({ id: run.id, revision: run.revision });
  }
  const risk = riskModelSnapshotSchema.parse(
    await send("/risk-models", "risk", {
      adjustmentRuns: runs,
      asOf: now(),
      estimator: "ledoit_wolf",
      expectedReturnAssumption: "scenario",
      annualExpectedReturns: instruments.map((i) => ({
        instrumentId: i.instrumentId,
        annualReturn: 0.05,
      })),
    }),
  );
  const target = targetSnapshotSchema.parse(
    await send("/targets", "target", {
      portfolioId: portfolio.id,
      mandateRevision: 1,
      riskModel: { id: risk.id, revision: 1 },
      valuation: { id: valuation.id, revision: 1 },
      method: "equal_weight",
    }),
  );
  const input = {
    target: { id: target.id, revision: 1 },
    valuation: { id: valuation.id, revision: 1 },
    newPrices: instruments.map((i) => ({
      instrumentId: i.instrumentId,
      currency: "USD",
      price: "100",
      quotedAt: now(),
      sourceRef: prefix + "-price",
      reason: "Authored current synthetic teaching price",
    })),
  };
  return { mandate, portfolio, valuation, instruments, risk, target, input };
}
