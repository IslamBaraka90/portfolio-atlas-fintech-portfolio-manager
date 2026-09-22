import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../src/app.js";
import { fixtureTime } from "@portfolio-atlas/testing";
import { seedTrading } from "../../../tests/helpers/seed-trading.js";

test("durable backup restores raw evidence, book replay and issued reports while later live changes remain separate", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "portfolio-atlas-recovery-"));
  const app = buildApp({
    databasePath: join(directory, "live.sqlite"),
    clock: { now: () => fixtureTime },
  });
  t.after(async () => {
    await app.close();
    const target = resolve(directory),
      root = resolve(tmpdir()) + sep;
    assert.ok(
      target.startsWith(root) && target.slice(root.length).startsWith("portfolio-atlas-recovery-"),
    );
    rmSync(target, { recursive: true, force: true });
  });
  const get = async (path: string) => (await app.inject("/api/v1" + path)).json().data;
  const post = async (path: string, key: string, payload: object) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      payload,
      headers: { "idempotency-key": "recover-" + key },
    });
    assert.equal(r.statusCode, 201, r.body);
    return r.json().data;
  };
  const seed = await seedTrading(get, post, "recover-seed", () => fixtureTime);
  const book = await post("/ledger/events", "buy", {
    portfolioId: seed.portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: seed.instruments[0]!.instrumentId,
    instrumentRevision: seed.instruments[0]!.revision,
    quantity: "10",
    unitPrice: "100",
    fee: "0",
    occurredAt: fixtureTime,
    sourceRef: "recover-buy",
  });
  const value = await post("/valuations", "value", {
    portfolioId: seed.portfolio.id,
    checkpoint: book.book.checkpoint,
    asOf: fixtureTime,
    prices: [],
    overrides: [seed.input.newPrices[0]],
  });
  const draft = await post("/reports", "draft", {
    portfolioId: seed.portfolio.id,
    title: "Recovery evidence report",
    asOf: fixtureTime,
    dataCutoff: fixtureTime,
    valuation: { id: value.id, revision: 1 },
  });
  const approved = await post("/reports/" + draft.id + "/approval", "approve", {
    expectedRevision: 1,
    actor: "Local reviewer",
    reason: "Review missing coverage before this restore demonstration.",
    acknowledgeExceptions: true,
  });
  const exportPath = "/api/v1/reports/" + approved.id + "/export.json?revision=2";
  const originalExport = (await app.inject(exportPath)).body;
  const checkpoint = await post("/governance/backups", "backup", {
    reason: "Capture the reconciled ten-share book and approved report.",
  });
  assert.ok(checkpoint.files > 1, "Referenced raw archives are included.");
  assert.deepEqual(
    await post("/governance/backups", "backup", {
      reason: "Capture the reconciled ten-share book and approved report.",
    }),
    checkpoint,
  );
  await post("/ledger/events", "later", {
    portfolioId: seed.portfolio.id,
    kind: "deposit",
    currency: "USD",
    amount: "500",
    occurredAt: fixtureTime,
    sourceRef: "after-backup",
  });
  const restored = await post("/governance/backups/" + checkpoint.id + "/restore", "restore", {
    reason: "Verify isolated replay before any manual recovery promotion.",
  });
  assert.equal(restored.status, "verified", JSON.stringify(restored));
  const restoredApp = buildApp({
    databasePath: join(restored.restoredDirectory, "book.sqlite"),
    clock: { now: () => fixtureTime },
  });
  try {
    const replay = (
      await restoredApp.inject("/api/v1/portfolios/" + seed.portfolio.id + "/book")
    ).json().data;
    assert.deepEqual(replay, book);
    assert.equal((await restoredApp.inject(exportPath)).body, originalExport);
    const current = await get("/portfolios/" + seed.portfolio.id + "/book");
    assert.equal(current.book.checkpoint, book.book.checkpoint + 1);
  } finally {
    await restoredApp.close();
  }
  const file = join(directory, "backups", checkpoint.id, "book.sqlite"),
    bytes = readFileSync(file);
  bytes[0] = bytes[0]! ^ 255;
  writeFileSync(file, bytes);
  const failed = await post("/governance/backups/" + checkpoint.id + "/restore", "corrupt", {
    reason: "Demonstrate rejection of a changed backup file.",
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.restoredDirectory, null);
  const status = await get("/governance/recovery");
  assert.equal(status.checkpoints.length, 1);
  assert.equal(status.attempts.length, 2);
  assert.equal((await app.inject(exportPath)).body, originalExport);
});
test("memory lessons expose recovery as unavailable without manufacturing a checkpoint", async (t) => {
  const app = buildApp();
  t.after(() => app.close());
  assert.equal((await app.inject("/api/v1/governance/recovery")).json().data.enabled, false);
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/governance/backups",
    headers: { "idempotency-key": "memory-backup" },
    payload: { reason: "A memory database has no durable raw evidence." },
  });
  assert.equal(response.statusCode, 409);
});
