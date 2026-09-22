import assert from "node:assert/strict";
import test from "node:test";
import {
  syntheticAliases,
  syntheticInstruments,
  demoMandate,
  fixtureTime,
} from "@portfolio-atlas/testing";
import {
  Commands,
  InstrumentService,
  PortfolioService,
  evaluateEligibility,
} from "@portfolio-atlas/core";
import { FintechIdentityResolver } from "../src/analytics/fintech-algorithms/identity-resolver.js";
import { MemoryInstrumentRepository } from "../src/persistence/memory-instrument-repository.js";
import { MemoryPortfolioRepository } from "../src/persistence/memory-portfolio-repository.js";
import { SyntheticInstrumentProvider } from "../src/market-data/synthetic-instrument-provider.js";
import { YahooInstrumentProvider } from "../src/market-data/yahoo-finance/instrument-provider.js";
const resolver = new FintechIdentityResolver();
const query = {
  symbol: "AUR-OLD",
  venueMic: "XNAS",
  validAt: "2025-12-31T23:59:59Z",
  knowledgeAt: "2026-09-22T10:00:00Z",
};
test("old and new tickers preserve listing identity at the half-open boundary", () => {
  assert.equal(resolver.resolve(query, syntheticAliases).canonicalId, "DEMO-AURORA-US");
  assert.equal(
    resolver.resolve({ ...query, validAt: "2026-01-01T00:00:00Z" }, syntheticAliases).status,
    "unmapped",
  );
  assert.equal(
    resolver.resolve(
      { ...query, symbol: "AURA", validAt: "2026-01-01T00:00:00Z" },
      syntheticAliases,
    ).canonicalId,
    "DEMO-AURORA-US",
  );
  assert.equal(
    resolver.resolve({ ...query, knowledgeAt: "2024-01-01T00:00:00Z" }, syntheticAliases).status,
    "unmapped",
  );
});
test("overlapping aliases to different listings stay ambiguous", () => {
  const duplicate = {
    ...syntheticAliases[0]!,
    assertionId: "conflicting-alias",
    listingId: "DIFFERENT-LINE",
  };
  const result = resolver.resolve(query, [...syntheticAliases, duplicate]);
  assert.equal(result.status, "ambiguous");
  assert.equal(result.canonicalId, null);
  assert.equal(result.candidateCanonicalIds.length, 2);
});
test("eligibility distinguishes full synthetic evidence, unknown trading units and prohibitions", () => {
  const mandate = {
    ...demoMandate,
    id: "mandate",
    revision: 1,
    createdAt: fixtureTime,
    updatedAt: fixtureTime,
  };
  assert.equal(
    evaluateEligibility(syntheticInstruments[0]!, mandate, fixtureTime).status,
    "eligible",
  );
  assert.equal(
    evaluateEligibility(syntheticInstruments[1]!, mandate, fixtureTime).status,
    "unresolved",
  );
  assert.equal(
    evaluateEligibility(
      { ...syntheticInstruments[0]!, assetType: "unsupported" },
      mandate,
      fixtureTime,
    ).status,
    "ineligible",
  );
  assert.equal(
    evaluateEligibility(
      syntheticInstruments[0]!,
      { ...mandate, restrictedInstrumentIds: ["DEMO-AURORA"] },
      fixtureTime,
    ).status,
    "ineligible",
  );
});
test("explicit selection keeps two similar-name securities separate and replay is idempotent", async () => {
  let id = 0;
  const ids = { next: () => "id-" + ++id };
  const clock = { now: () => fixtureTime };
  const records = new MemoryPortfolioRepository();
  const service = new InstrumentService(
    { synthetic: new SyntheticInstrumentProvider(syntheticInstruments, clock) },
    new MemoryInstrumentRepository(),
    clock,
    ids,
    new Commands(records),
    new PortfolioService(records, clock, ids),
  );
  const search = await service.search("Aurora", "synthetic");
  assert.equal(search.candidates.length, 2);
  const first = await service.resolve(search.candidates[0]!.candidateId, {
    key: "resolve-first",
    requestId: "request",
  });
  const second = await service.resolve(search.candidates[1]!.candidateId, {
    key: "resolve-second",
    requestId: "request",
  });
  assert.notEqual(first.instrument?.instrumentId, second.instrument?.instrumentId);
  const replay = await service.resolve(search.candidates[0]!.candidateId, {
    key: "resolve-first",
    requestId: "retry",
  });
  assert.deepEqual(replay, first);
  assert.equal(service.list().length, 2);
});
test("a Yahoo symbol mismatch cannot create an instrument", async () => {
  let id = 0;
  const ids = { next: () => "id-" + ++id };
  const clock = { now: () => fixtureTime };
  const records = new MemoryPortfolioRepository();
  const yahoo = new YahooInstrumentProvider(
    {
      search: async () => ({
        quotes: [{ isYahooFinance: true, symbol: "ASKED", exchange: "X", quoteType: "EQUITY" }],
      }),
      quote: async () => ({ symbol: "DIFFERENT", exchange: "X" }),
    },
    clock,
  );
  const service = new InstrumentService(
    { yahoo },
    new MemoryInstrumentRepository(),
    clock,
    ids,
    new Commands(records),
    new PortfolioService(records, clock, ids),
  );
  const search = await service.search("Asked", "yahoo");
  const resolved = await service.resolve(search.candidates[0]!.candidateId, {
    key: "mismatch",
    requestId: "request",
  });
  assert.equal(resolved.status, "unresolved");
  assert.equal(service.list().length, 0);
});
