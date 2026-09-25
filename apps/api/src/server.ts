import { accessConfigSchema } from "@portfolio-atlas/contracts";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LiveConfigError, parseLiveRuntime } from "@portfolio-atlas/core";
import { DemoCacheError, loadDemoCache } from "@portfolio-atlas/adapters";
import { buildApp } from "./app.js";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 3100);
if (!["127.0.0.1", "::1"].includes(host))
  throw new Error("The teaching server runs on loopback only.");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("API_PORT must be a valid port.");
if (process.env.DATA_MODE && process.env.DATA_MODE !== "synthetic") {
  throw new Error("Default data mode is synthetic; enable Yahoo explicitly with YAHOO_ENABLED.");
}

// Part V runtime (ADR 0005). An invalid value stops startup and names the variable.
let live;
try {
  live = parseLiveRuntime(process.env);
} catch (error) {
  if (error instanceof LiveConfigError) {
    console.error("Invalid live-desk configuration. " + error.message);
    process.exit(1);
  }
  throw error;
}

// Chapter 25 demo cache: record live replies, or replay a recorded session offline on
// a clock that starts at the recording's first observation and runs in real time.
const recordPath = process.env.LIVE_CACHE_RECORD;
const replayPath = process.env.DEMO_CACHE_PATH;
// Test-only opt-in: ATLAS_CLOCK_START runs the server clock in real time from a fixed
// instant, so journeys over dated synthetic fixtures stay fresh on any calendar day.
const clockStart = process.env.ATLAS_CLOCK_START;
if (recordPath && replayPath) {
  console.error("Set LIVE_CACHE_RECORD or DEMO_CACHE_PATH, not both.");
  process.exit(1);
}
if (clockStart && replayPath) {
  console.error("Set ATLAS_CLOCK_START or DEMO_CACHE_PATH, not both; replay owns its clock.");
  process.exit(1);
}
const runningFrom = (start: number) => {
  const began = Date.now();
  return { now: () => new Date(start + (Date.now() - began)).toISOString() };
};
let clock: { now(): string } | undefined;
if (clockStart) {
  const start = Date.parse(clockStart);
  if (!/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(clockStart) || Number.isNaN(start)) {
    console.error(
      "ATLAS_CLOCK_START must be an ISO-8601 instant with an offset, such as 2026-09-22T15:00:00Z.",
    );
    process.exit(1);
  }
  clock = runningFrom(start);
}
if (replayPath) {
  try {
    const { manifest } = loadDemoCache(replayPath);
    clock = runningFrom(Date.parse(manifest.recordedFrom ?? new Date().toISOString()));
  } catch (error) {
    console.error(error instanceof DemoCacheError ? error.message : String(error));
    process.exit(1);
  }
}

const app = buildApp({
  live,
  ...(clock ? { clock } : {}),
  ...(recordPath
    ? { demoCache: { mode: "record" as const, path: recordPath } }
    : replayPath
      ? { demoCache: { mode: "replay" as const, path: replayPath } }
      : {}),
  liveAutostart: true,
  logger: true,
  databasePath:
    process.env.DATABASE_PATH ??
    fileURLToPath(new URL("../../../.data/portfolio-atlas.sqlite", import.meta.url)),
  ...(process.env.AUTH_CONFIG_PATH
    ? {
        accessConfig: accessConfigSchema.parse(
          JSON.parse(readFileSync(process.env.AUTH_CONFIG_PATH, "utf8")),
        ),
      }
    : {}),
  secureCookie: process.env.AUTH_SECURE_COOKIE === "true",
  yahooEnabled: process.env.YAHOO_ENABLED === "true",
  yahooTimeoutMs: Number(process.env.YAHOO_REQUEST_TIMEOUT_MS ?? 10000),
  yahooConcurrency: Number(process.env.YAHOO_MAX_CONCURRENCY ?? 2),
  allowedOrigin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:" + (process.env.WEB_PORT ?? "5173"),
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
