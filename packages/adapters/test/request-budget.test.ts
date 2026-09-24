import assert from "node:assert/strict";
import test from "node:test";
import { ProviderError, RequestBudget } from "../src/market-data/request-budget.js";

const deferred = () => {
  let resolve!: (v: string) => void;
  const promise = new Promise<string>((r) => (resolve = r));
  return { promise, resolve };
};

test("interactive budgets still fail fast when every slot is busy", async () => {
  const budget = new RequestBudget(1, 1_000);
  const first = deferred();
  const running = budget.run(() => first.promise);
  await new Promise((r) => setImmediate(r));
  await assert.rejects(
    budget.run(async () => "second"),
    (e) => e instanceof ProviderError && e.failure.code === "BUDGET_EXCEEDED",
  );
  first.resolve("first");
  assert.equal(await running, "first");
});

test("scheduled budgets queue in arrival order under the concurrency limit", async () => {
  const budget = new RequestBudget(2, 1_000, { queue: true });
  const gates = [deferred(), deferred(), deferred(), deferred()];
  let active = 0,
    peak = 0;
  const order: number[] = [];
  const runs = gates.map((g, i) =>
    budget.run(async () => {
      active++;
      peak = Math.max(peak, active);
      order.push(i);
      const value = await g.promise;
      active--;
      return value;
    }),
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(budget.queued, 2);
  gates.forEach((g, i) => g.resolve("r" + i));
  assert.deepEqual(await Promise.all(runs), ["r0", "r1", "r2", "r3"]);
  assert.equal(peak, 2);
  assert.deepEqual(order, [0, 1, 2, 3]);
});

test("the queue is bounded", async () => {
  const budget = new RequestBudget(1, 1_000, { queue: true, maxQueued: 1 });
  const g = deferred();
  const a = budget.run(() => g.promise);
  const b = budget.run(async () => "b");
  await new Promise((r) => setImmediate(r));
  await assert.rejects(
    budget.run(async () => "c"),
    (e) => e instanceof ProviderError,
  );
  g.resolve("a");
  assert.deepEqual(await Promise.all([a, b]), ["a", "b"]);
});

test("a per-minute cap and spacing delay starts on a controlled clock", async () => {
  let now = 0;
  const waits: number[] = [];
  const budget = new RequestBudget(4, 1_000, {
    queue: true,
    perMinute: 2,
    minIntervalMs: 250,
    now: () => now,
    wait: async (ms) => {
      waits.push(ms);
      now += ms;
    },
  });
  const results = await Promise.all([1, 2, 3].map((n) => budget.run(async () => n)));
  assert.deepEqual(results, [1, 2, 3]);
  // Starts at 0, 250 (spacing) and 60,000 (the first start leaves the one-minute window).
  assert.deepEqual(waits, [250, 59_750]);
  assert.equal(now, 60_000);
});
