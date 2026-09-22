import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const environmentFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? 3100);
if (!["127.0.0.1", "::1"].includes(host)) throw new Error("Chapter 1 runs on loopback only.");
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("API_PORT must be a valid port.");
if (process.env.DATA_MODE && process.env.DATA_MODE !== "synthetic") {
  throw new Error("Chapter 1 supports synthetic data only.");
}

const app = buildApp({
  logger: true,
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
