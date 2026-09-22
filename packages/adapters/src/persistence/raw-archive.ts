import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RawArchive } from "@portfolio-atlas/core";
function checkedHash(hash: string) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid archive hash.");
  return hash;
}
function verify(json: string, hash: string): unknown {
  if (createHash("sha256").update(json).digest("hex") !== checkedHash(hash))
    throw new Error("Archived evidence hash mismatch.");
  return JSON.parse(json);
}
function serialize(raw: unknown) {
  const json = JSON.stringify(raw);
  if (json === undefined) throw new Error("Raw evidence must be JSON serializable.");
  return { json, hash: createHash("sha256").update(json).digest("hex") };
}
export class FileRawArchive implements RawArchive {
  constructor(private readonly directory: string) {}
  async read(hash: string): Promise<unknown> {
    return verify(
      await readFile(resolve(this.directory, checkedHash(hash) + ".json"), "utf8"),
      hash,
    );
  }
  async save(raw: unknown) {
    const { json, hash } = serialize(raw);
    await mkdir(this.directory, { recursive: true });
    try {
      await writeFile(resolve(this.directory, hash + ".json"), json, {
        encoding: "utf8",
        flag: "wx",
      });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
    return { hash, reference: "sha256:" + hash };
  }
}
export class MemoryRawArchive implements RawArchive {
  readonly entries = new Map<string, string>();
  async read(hash: string): Promise<unknown> {
    const json = this.entries.get(checkedHash(hash));
    if (json === undefined) throw new Error("Archived evidence not found.");
    return verify(json, hash);
  }
  async save(raw: unknown) {
    const { json, hash } = serialize(raw);
    this.entries.set(hash, json);
    return { hash, reference: "memory:sha256:" + hash };
  }
}
