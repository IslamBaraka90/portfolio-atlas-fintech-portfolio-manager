import assert from "node:assert/strict";
import test from "node:test";
import { FintechAdjustmentEngine } from "../src/analytics/fintech-algorithms/adjustment-engine.js";
import { SyntheticChartProvider } from "../src/market-data/synthetic-chart-provider.js";
import { FintechMarketQualityValidator } from "../src/analytics/fintech-algorithms/market-quality.js";
import { MemoryRawArchive } from "../src/persistence/raw-archive.js";
import { ProviderActionNormalizer } from "../src/market-data/action-normalizer.js";
import { marketDatasetSchema, type ActionReview } from "@portfolio-atlas/contracts";
import { syntheticInstruments, fixtureTime } from "@portfolio-atlas/testing";
async function fixture() {
  const instrument = syntheticInstruments[0]!,
    clock = { now: () => fixtureTime };
  const request = {
    instrumentId: instrument.instrumentId,
    instrumentRevision: 1,
    from: "2026-09-01",
    to: "2026-09-18",
    scenario: "corporate-actions" as const,
  };
  const reply = await new SyntheticChartProvider(clock).chart(instrument, request);
  if (reply.status !== "available") throw new Error("Fixture unavailable");
  const archive = await new MemoryRawArchive().save(reply.data.raw);
  const dataset = marketDatasetSchema.parse({
    id: "dataset",
    revision: 1,
    createdAt: fixtureTime,
    instrument,
    request,
    source: "synthetic",
    observedAt: fixtureTime,
    cache: "fresh",
    sourceHash: archive.hash,
    archiveRef: archive.reference,
    interval: "1d",
    timezone: instrument.timezone,
    quoteUnit: instrument.quoteUnit,
    basis: "synthetic_unadjusted",
    availability: "observed_now_not_historical",
    rows: reply.data.rows,
    quality: new FintechMarketQualityValidator().validate(
      reply.data,
      instrument,
      request,
      fixtureTime,
    ),
  });
  const review: ActionReview = {
    id: "review",
    createdAt: fixtureTime,
    datasetId: dataset.id,
    datasetRevision: 1,
    sourceHash: dataset.sourceHash,
    ...new ProviderActionNormalizer().normalize(dataset, reply.data.raw),
  };
  return { dataset, review };
}
test("hand-derived split and dividend factors preserve economics without altering source", async () => {
  const { dataset, review } = await fixture();
  const before = structuredClone(dataset);
  const run = new FintechAdjustmentEngine().calculate(
    dataset,
    review,
    { reviewId: "review", actionKnowledgeAt: "2026-09-09T00:00:00Z", targetCurrency: "EUR" },
    fixtureTime,
  );
  assert.equal(run.status, "ready");
  assert.equal(run.series[0]!.providerClose, 100);
  assert.equal(run.series[0]!.splitAdjustedClose, 50);
  assert.equal(run.series[0]!.splitAdjustedVolume, 2000);
  assert.ok(Math.abs(run.series[3]!.dividendFactor - 50 / 52) < 1e-11);
  assert.ok(
    Math.abs(run.series[4]!.totalReturnClose / run.series[3]!.totalReturnClose - 1) < 1e-11,
  );
  assert.equal(run.series[4]!.convertedClose, 45);
  assert.deepEqual(dataset, before);
});
test("future revisions, correction and cancellation change derived results without overwriting", async () => {
  const { dataset, review } = await fixture();
  const engine = new FintechAdjustmentEngine();
  const before = engine.calculate(
    dataset,
    review,
    { reviewId: "review", actionKnowledgeAt: "2026-09-09T00:00:00Z", targetCurrency: "USD" },
    fixtureTime,
  );
  assert.ok(
    before.excludedActions.some((row) => row.revision === 2 && row.reason.includes("Unavailable")),
  );
  const revised = engine.calculate(
    dataset,
    review,
    { reviewId: "review", actionKnowledgeAt: "2026-09-16T00:00:00Z", targetCurrency: "USD" },
    fixtureTime,
  );
  assert.equal(revised.selectedActions.find((row) => row.kind === "cash_dividend")?.revision, 2);
  assert.notEqual(revised.series[0]!.totalReturnClose, before.series[0]!.totalReturnClose);
  const cancelled = engine.calculate(
    dataset,
    review,
    { reviewId: "review", actionKnowledgeAt: "2026-09-21T00:00:00Z", targetCurrency: "USD" },
    fixtureTime,
  );
  assert.equal(cancelled.series[0]!.totalReturnClose, 50);
  assert.ok(cancelled.excludedActions.some((row) => row.reason.includes("Cancelled")));
});
test("unknown provider basis, null volume and a rejected session cannot be silently adjusted", async () => {
  const { dataset, review } = await fixture();
  const engine = new FintechAdjustmentEngine();
  const input = {
    reviewId: "review",
    actionKnowledgeAt: "2026-09-09T00:00:00Z",
    targetCurrency: "EUR" as const,
  };
  assert.equal(
    engine.calculate({ ...dataset, basis: "provider_returned" }, review, input, fixtureTime).status,
    "unsupported",
  );
  const missing = structuredClone(dataset);
  missing.rows[0]!.volume = null;
  assert.equal(engine.calculate(missing, review, input, fixtureTime).status, "unsupported");
  const bad = structuredClone(dataset);
  bad.quality.quarantinedIndexes = [1];
  assert.equal(engine.calculate(bad, review, input, fixtureTime).status, "unsupported");
});
