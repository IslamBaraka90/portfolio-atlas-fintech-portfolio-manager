import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";
import type { DataMode, LiveInterval } from "@portfolio-atlas/contracts";
import type {
  BarBatch,
  BarProvider,
  Clock,
  ProviderReply,
  QuoteBatch,
  QuoteProvider,
} from "@portfolio-atlas/core";

// Chapter 25 demo cache (chapter-25.demo-cache.v1). Recording keeps every provider
// reply the live desk received; replay serves the latest reply recorded at or before
// the replay clock, so a learner can rerun a recorded session offline. The cache and
// its manifest stay under ignored .data/ paths: recorded Yahoo data is for local
// replay only and is never redistributed.
export const demoCacheVersion = "chapter-25.demo-cache.v1";
export class DemoCacheError extends Error {}

interface Entry {
  kind: "quotes" | "bars";
  key: string;
  observedAt: string;
  reply: ProviderReply<unknown>;
}
const manifestSchema = z.strictObject({
  version: z.literal(demoCacheVersion),
  recordedFrom: z.string().nullable(),
  recordedTo: z.string().nullable(),
  entries: z.number().int().nonnegative(),
  symbols: z.array(z.string()),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type DemoCacheManifest = z.infer<typeof manifestSchema>;

const manifestPath = (path: string) => path + ".manifest.json";
const writeAtomic = (path: string, text: string) => {
  writeFileSync(path + ".tmp", text);
  renameSync(path + ".tmp", path);
};

export class DemoCacheRecorder {
  private readonly entries: Entry[] = [];
  private readonly symbols = new Set<string>();
  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }
  record(entry: Entry, symbols: string[]) {
    this.entries.push(structuredClone(entry));
    symbols.forEach((s) => this.symbols.add(s));
    const text = JSON.stringify(this.entries);
    const times = this.entries.map((e) => e.observedAt).sort();
    const manifest: DemoCacheManifest = {
      version: demoCacheVersion,
      recordedFrom: times[0] ?? null,
      recordedTo: times.at(-1) ?? null,
      entries: this.entries.length,
      symbols: [...this.symbols].sort(),
      sha256: createHash("sha256").update(text).digest("hex"),
    };
    writeAtomic(this.path, text);
    writeAtomic(manifestPath(this.path), JSON.stringify(manifest, null, 2));
  }
}

// Verifies the cache against its manifest before any replay: one changed byte and the
// cache is refused, rather than replaying data nobody recorded.
export function loadDemoCache(path: string) {
  if (!existsSync(path) || !existsSync(manifestPath(path)))
    throw new DemoCacheError("Demo cache or manifest not found at " + path + ".");
  const text = readFileSync(path, "utf8");
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath(path), "utf8")));
  if (createHash("sha256").update(text).digest("hex") !== manifest.sha256)
    throw new DemoCacheError("Demo cache bytes do not match the manifest hash; refusing replay.");
  const entries = JSON.parse(text) as Entry[];
  if (entries.length !== manifest.entries)
    throw new DemoCacheError("Demo cache entry count does not match the manifest.");
  return { manifest, entries };
}

export class RecordingQuoteProvider implements QuoteProvider {
  readonly mode: DataMode;
  readonly defaultSymbols?: string[];
  constructor(
    private readonly inner: QuoteProvider,
    private readonly recorder: DemoCacheRecorder,
  ) {
    this.mode = inner.mode;
    if (inner.defaultSymbols) this.defaultSymbols = inner.defaultSymbols;
  }
  async quotes(symbols: string[]) {
    const reply = await this.inner.quotes(symbols);
    this.recorder.record(
      { kind: "quotes", key: JSON.stringify(symbols), observedAt: reply.observedAt, reply },
      symbols,
    );
    return reply;
  }
}

export class RecordingBarProvider implements BarProvider {
  readonly mode: DataMode;
  constructor(
    private readonly inner: BarProvider,
    private readonly recorder: DemoCacheRecorder,
  ) {
    this.mode = inner.mode;
  }
  async bars(symbol: string, interval: LiveInterval, window: { from: string; to: string }) {
    const reply = await this.inner.bars(symbol, interval, window);
    this.recorder.record(
      {
        kind: "bars",
        key: JSON.stringify([symbol, interval]),
        observedAt: reply.observedAt,
        reply,
      },
      [symbol],
    );
    return reply;
  }
}

// The latest recorded reply for the same request at or before the replay clock.
function replay<T>(
  entries: Entry[],
  kind: Entry["kind"],
  key: string,
  now: string,
  mode: DataMode,
) {
  const hit = entries
    .filter((e) => e.kind === kind && e.key === key && e.observedAt <= now)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
    .at(-1);
  if (hit) return structuredClone(hit.reply) as ProviderReply<T>;
  return {
    status: "unavailable",
    source: mode,
    observedAt: now,
    cache: "none",
    failure: {
      code: "NOT_FOUND",
      message: "No recorded reply for this request at the replay time.",
      retryable: false,
    },
  } as ProviderReply<T>;
}
const recordedMode = (entries: Entry[]): DataMode =>
  (entries.find((e) => e.reply.status === "available")?.reply.source as DataMode) ?? "synthetic";

// Quotes replay symbol by symbol: for each requested symbol, the row from the latest
// recorded batch at or before the replay clock. A replayed desk may batch its symbols
// differently (another watchlist order, extra FX legs) and still get the same rows.
export class ReplayQuoteProvider implements QuoteProvider {
  readonly mode: DataMode;
  readonly defaultSymbols: string[];
  private readonly batches: { observedAt: string; reply: ProviderReply<QuoteBatch> }[];
  constructor(
    entries: Entry[],
    private readonly clock: Clock,
    manifest: DemoCacheManifest,
  ) {
    this.mode = recordedMode(entries);
    this.batches = entries
      .filter((e) => e.kind === "quotes")
      .map((e) => ({ observedAt: e.observedAt, reply: e.reply as ProviderReply<QuoteBatch> }))
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    // The recorded watchlist in first-requested order, without FX legs.
    const first = entries.find((e) => e.kind === "quotes");
    const requested = first ? (JSON.parse(first.key) as string[]) : manifest.symbols;
    this.defaultSymbols = requested.filter((symbol) => !symbol.endsWith("=X"));
  }
  async quotes(symbols: string[]): Promise<ProviderReply<QuoteBatch>> {
    const now = this.clock.now();
    const available = this.batches.filter(
      (b) => b.observedAt <= now && b.reply.status === "available",
    );
    const rows: QuoteBatch["rows"] = [];
    const missing: QuoteBatch["missing"] = [];
    let observedAt: string | null = null;
    for (const symbol of symbols) {
      const hit = available
        .filter(
          (b) =>
            b.reply.status === "available" && b.reply.data.rows.some((r) => r.symbol === symbol),
        )
        .at(-1);
      if (!hit || hit.reply.status !== "available") {
        missing.push({ symbol, reason: "No recorded quote for this symbol at the replay time." });
        continue;
      }
      rows.push(structuredClone(hit.reply.data.rows.find((r) => r.symbol === symbol)!));
      if (!observedAt || hit.observedAt > observedAt) observedAt = hit.observedAt;
    }
    return {
      status: "available",
      source: this.mode,
      observedAt: observedAt ?? now,
      cache: "hit",
      data: { rows, missing, raw: { replay: demoCacheVersion, at: now, symbols } },
    };
  }
}

export class ReplayBarProvider implements BarProvider {
  readonly mode: DataMode;
  constructor(
    private readonly entries: Entry[],
    private readonly clock: Clock,
  ) {
    this.mode = recordedMode(entries);
  }
  async bars(symbol: string, interval: LiveInterval) {
    return replay<BarBatch>(
      this.entries,
      "bars",
      JSON.stringify([symbol, interval]),
      this.clock.now(),
      this.mode,
    );
  }
}
