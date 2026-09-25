import assert from "node:assert/strict";
import test from "node:test";
import type { Instrument } from "@portfolio-atlas/contracts";
import { syntheticInstruments } from "@portfolio-atlas/testing";
import { liveIdentityPolicy, syntheticIdentityPolicy } from "../src/index.js";

const verified = syntheticInstruments[0]!;
const observed: Instrument = {
  ...verified,
  instrumentId: "YAHOO-AAPL",
  source: "yahoo",
  identityStatus: "provider_observed",
  tickSize: null,
  lotSize: null,
  sector: null,
};

test("the teaching book admits only synthetic-verified listings", () => {
  assert.equal(syntheticIdentityPolicy.refuse(verified), null);
  assert.match(syntheticIdentityPolicy.refuse(observed)!, /verified equity\/ETF identity/);
});

test("the live book admits observed equities with an established currency and scale", () => {
  assert.equal(liveIdentityPolicy.refuse(observed), null);
  assert.equal(liveIdentityPolicy.refuse(verified), null);
  assert.match(
    liveIdentityPolicy.refuse({ ...observed, assetType: "unsupported" })!,
    /Only equities and ETFs/,
  );
  assert.match(
    liveIdentityPolicy.refuse({
      ...observed,
      quoteUnit: { reported: "JPY", currency: null, scaleToCurrency: null, evidence: "" },
    })!,
    /established quote currency/,
  );
  assert.equal(liveIdentityPolicy.version, "chapter-25.live-identity.v1");
});
