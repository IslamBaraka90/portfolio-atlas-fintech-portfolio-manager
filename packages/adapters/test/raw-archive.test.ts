import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { createHash } from "node:crypto";
import { FileRawArchive } from "../src/persistence/raw-archive.js";
test("raw archive is content-addressed and never overwrites evidence", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-atlas-evidence-"));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("portfolio-atlas-evidence-"));
    return rm(directory, { recursive: true, force: true });
  });
  const archive = new FileRawArchive(directory);
  const raw = { rows: [{ timestamp: "malformed", close: null, volume: 0 }] };
  const first = await archive.save(raw),
    second = await archive.save(raw);
  assert.deepEqual(second, first);
  const saved = await readFile(join(directory, first.hash + ".json"), "utf8");
  assert.equal(createHash("sha256").update(saved).digest("hex"), first.hash);
  assert.deepEqual(JSON.parse(saved), raw);
  assert.notEqual((await archive.save({ rows: [] })).hash, first.hash);
});
