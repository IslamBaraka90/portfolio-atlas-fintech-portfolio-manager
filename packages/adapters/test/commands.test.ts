import assert from "node:assert/strict";
import test from "node:test";
import { ApplicationError, Commands, PortfolioService } from "@portfolio-atlas/core";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";
import { MemoryPortfolioRepository } from "../src/persistence/memory-portfolio-repository.js";
test("concurrent command replay shares one operation and blocks a conflicting synchronous write", async () => {
  const store = new MemoryPortfolioRepository();
  const commands = new Commands(store);
  const portfolios = new PortfolioService(
    store,
    { now: () => fixtureTime },
    { next: () => "fixed-id" },
    commands,
  );
  let release!: () => void;
  let calls = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const context = { key: "shared-command", requestId: "request" };
  const first = commands.execute("provider-read", { symbol: "AURA" }, context, async () => {
    calls++;
    await gate;
    return { id: "result" };
  });
  const second = commands.execute("provider-read", { symbol: "AURA" }, context, async () => {
    calls++;
    return { id: "wrong" };
  });
  assert.throws(
    () => portfolios.createMandate(demoMandate, context),
    (error: unknown) => error instanceof ApplicationError && error.code === "IDEMPOTENCY_CONFLICT",
  );
  release();
  assert.deepEqual(await first, await second);
  assert.equal(calls, 1);
});
test("a transient provider outcome may be retried; completed records remain immutable", async () => {
  const commands = new Commands(new MemoryPortfolioRepository());
  const context = { key: "retry-provider", requestId: "request" };
  await commands.execute(
    "resolve",
    {},
    context,
    async () => ({ status: "unavailable" }),
    (result) => result.status === "resolved",
  );
  const completed = await commands.execute(
    "resolve",
    {},
    context,
    async () => ({ status: "resolved" }),
    (result) => result.status === "resolved",
  );
  assert.equal(completed.status, "resolved");
  completed.status = "changed";
  const replay = await commands.execute("resolve", {}, context, async () => ({ status: "wrong" }));
  assert.equal(replay.status, "resolved");
});
