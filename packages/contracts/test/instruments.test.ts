import assert from "node:assert/strict";
import test from "node:test";
import { aliasQuerySchema, instrumentSchema } from "../src/instruments.js";
import { syntheticInstruments } from "@portfolio-atlas/testing";
test("identity evidence preserves subunits and genuinely unknown trading units", () => {
  const instrument = instrumentSchema.parse(syntheticInstruments[1]);
  assert.equal(instrument.quoteUnit.scaleToCurrency, 0.01);
  assert.equal(instrument.tickSize, null);
  assert.equal(instrument.lotSize, null);
});
test("alias queries make the installed package's whole-second boundary explicit", () => {
  assert.equal(
    aliasQuerySchema.safeParse({
      symbol: "AURA",
      venueMic: "XNAS",
      validAt: "2026-01-01T00:00:00Z",
      knowledgeAt: "2026-01-01T00:00:00.001Z",
    }).success,
    false,
  );
});
