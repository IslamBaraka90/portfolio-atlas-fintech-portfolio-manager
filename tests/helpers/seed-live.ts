import { expect, type APIRequestContext } from "@playwright/test";
import { demoMandate } from "@portfolio-atlas/testing";

// Seeds a funded demo portfolio holding 10 AURA through the real API, then runs one
// live cycle so quotes, FX, bars, valuation and risk exist for the live desks.
export async function seedLivePortfolio(
  api: APIRequestContext,
  now: () => string,
  prefix: string,
  name: string,
) {
  const post = async (path: string, key: string, data: object) => {
    const r = await api.post("/api/v1" + path, {
      headers: { "idempotency-key": prefix + "-" + key },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return (await r.json()).data;
  };
  const mandate = await post("/mandates", "mandate", demoMandate);
  const portfolio = await post("/portfolios", "portfolio", { name, mandateId: mandate.id });
  await post("/ledger/events", "deposit", {
    portfolioId: portfolio.id,
    kind: "deposit",
    occurredAt: "2026-09-01T00:00:00Z",
    currency: "USD",
    amount: "10000",
    sourceRef: prefix + "-capital",
  });
  const search = (await (await api.get("/api/v1/instruments/search?q=AURA")).json()).data;
  const instrument = (
    await post("/instruments/resolutions", "resolve", {
      candidateId: search.candidates[0].candidateId,
    })
  ).instrument;
  await post("/ledger/events", "buy", {
    portfolioId: portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: instrument.instrumentId,
    instrumentRevision: instrument.revision,
    quantity: "10",
    unitPrice: "100",
    fee: "0",
    occurredAt: now(),
    sourceRef: prefix + "-buy",
  });
  await post("/live/cycles", "cycle", {});
  return { portfolio, instrument };
}
