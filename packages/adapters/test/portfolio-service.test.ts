import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError, PortfolioService } from "@portfolio-atlas/core";
import { balancedAllocation, demoMandate, fixtureTime } from "@portfolio-atlas/testing";
import { MemoryPortfolioRepository } from "../src/persistence/memory-portfolio-repository.js";

function setup() {
  let serial = 0;
  let now = fixtureTime;
  const repository = new MemoryPortfolioRepository();
  return {
    repository,
    service: new PortfolioService(repository, { now: () => now }, { next: () => "id-" + ++serial }),
    setTime: (time: string) => {
      now = time;
    },
  };
}
const context = (key: string) => ({ key, requestId: "request-" + key });
const errorCode = (code: string) => (error: unknown) =>
  error instanceof ApplicationError && error.code === code;

test("duplicate commands replay without duplicate resources or audit events; changed input conflicts", () => {
  const { service } = setup();
  const first = service.createMandate(demoMandate, context("create"));
  assert.deepEqual(service.createMandate(demoMandate, context("create")), first);
  assert.equal(service.listMandates().length, 1);
  assert.equal(service.audit().length, 1);
  assert.throws(
    () => service.createMandate({ ...demoMandate, name: "Changed name" }, context("create")),
    errorCode("IDEMPOTENCY_CONFLICT"),
  );
});
test("revision conflicts, immutable history and currency consistency are explicit", () => {
  const { service, setTime } = setup();
  const mandate = service.createMandate(demoMandate, context("create"));
  service.createPortfolio(
    { name: "Learning portfolio", mandateId: mandate.id },
    context("portfolio"),
  );
  setTime("2026-09-22T11:00:00.000Z");
  const updated = service.updateMandate(
    mandate.id,
    1,
    { ...demoMandate, maxPositionWeight: 0.5 },
    context("update"),
  );
  assert.equal(updated.revision, 2);
  assert.equal(service.revisions(mandate.id)[0]?.maxPositionWeight, 0.4);
  assert.deepEqual(
    service.updateMandate(
      mandate.id,
      1,
      { ...demoMandate, maxPositionWeight: 0.5 },
      context("update"),
    ),
    updated,
  );
  assert.throws(
    () => service.updateMandate(mandate.id, 1, demoMandate, context("stale")),
    errorCode("REVISION_CONFLICT"),
  );
  assert.throws(
    () =>
      service.updateMandate(
        mandate.id,
        2,
        { ...demoMandate, baseCurrency: "EUR" },
        context("currency"),
      ),
    errorCode("CURRENCY_IN_USE"),
  );
  updated.allowedAssetTypes.length = 0;
  assert.equal(service.getMandate(mandate.id).allowedAssetTypes.length, 2);
});
test("evaluations retain policy revision, cannot travel through time, and are replayable", () => {
  const { service, setTime } = setup();
  const mandate = service.createMandate(demoMandate, context("create"));
  const evaluation = service.evaluate(mandate.id, 1, balancedAllocation, context("evaluate"));
  assert.equal(evaluation.result.status, "satisfied");
  setTime("2026-09-22T11:00:00.000Z");
  service.updateMandate(mandate.id, 1, demoMandate, context("update"));
  assert.deepEqual(service.getEvaluation(evaluation.id), evaluation);
  assert.equal(
    service.evaluate(mandate.id, 2, balancedAllocation, context("old")).result.status,
    "not_evaluable",
  );
  assert.equal(
    service.evaluate(
      mandate.id,
      2,
      { ...balancedAllocation, asOf: "2026-09-22T12:00:00.000Z" },
      context("future"),
    ).result.status,
    "not_evaluable",
  );
  assert.equal(service.audit()[1]?.requestId, "request-evaluate");
});
test("a new repository starts empty and cannot access the previous session", () => {
  const first = setup();
  const mandate = first.service.createMandate(demoMandate, context("create"));
  const restarted = setup();
  assert.deepEqual(restarted.service.listMandates(), []);
  assert.throws(() => restarted.service.getMandate(mandate.id), errorCode("NOT_FOUND"));
});
