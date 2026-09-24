import { parseLiveRuntime } from "@portfolio-atlas/core";
import { buildApp } from "../app.js";

// Opt-in: runs one real refresh cycle against Yahoo through the same composition
// as the server, with in-memory storage. Default tests never make this request.
if (process.env.MARKET_DATA_MODE !== "live") {
  console.error("Opt in with MARKET_DATA_MODE=live. This command makes live Yahoo requests.");
  process.exitCode = 2;
} else {
  const app = buildApp({ live: parseLiveRuntime(process.env) });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/live/cycles",
    headers: { "idempotency-key": "live-smoke-" + Date.now() },
  });
  const cycle = response.json().data;
  console.log(
    JSON.stringify({
      operation: "live-cycle",
      statusCode: response.statusCode,
      cadence: cycle?.cadence,
      session: cycle?.session?.basis,
      coversSession: cycle?.coversSession,
      status: cycle?.status,
      tasks: cycle?.tasks,
      health: cycle?.health?.status,
    }),
  );
  await app.close();
}
