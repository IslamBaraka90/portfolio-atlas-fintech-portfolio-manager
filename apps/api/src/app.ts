import { randomUUID } from "node:crypto";
import Fastify from "fastify";

// Construction is separate from listening, so HTTP behavior can be tested with inject().
export function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 128_000 });
  const sessionId = randomUUID();
  app.get("/api/v1/health", async () => ({
    name: "Portfolio Atlas",
    chapter: 1,
    mode: "synthetic",
    storage: "memory",
    sessionId,
  }));
  return app;
}
