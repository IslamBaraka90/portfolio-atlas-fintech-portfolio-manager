import type { FastifyRequest } from "fastify";
import { z } from "zod";
import type { ApiEnvelope, DataMode } from "@portfolio-atlas/contracts";
import type { Clock } from "@portfolio-atlas/core";

const keySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export function createHttpContext(
  clock: Clock,
  sessionId: string,
  storage: "memory" | "sqlite" = "memory",
) {
  return {
    response<T>(
      data: T,
      request: FastifyRequest,
      mode: DataMode | "mixed" = "synthetic",
    ): ApiEnvelope<T> {
      return {
        data,
        metadata: {
          schemaVersion: "1",
          mode,
          storage,
          sessionId,
          generatedAt: clock.now(),
        },
        requestId: request.id,
      };
    },
    command(request: FastifyRequest) {
      const key = keySchema.parse(request.headers["idempotency-key"]);
      const p = request.principal;
      const reason =
        request.routeOptions.url?.endsWith("/approval") &&
        request.body &&
        typeof request.body === "object" &&
        "reason" in request.body
          ? z.string().trim().min(10).max(500).parse(request.body.reason)
          : undefined;
      return {
        key: p ? JSON.stringify([p.actor.scopeId, p.actor.id, key]) : key,
        requestId: request.id,
        ...(reason ? { reviewReason: reason } : {}),
        ...(p ? { principal: p } : {}),
      };
    },
  };
}
export type HttpContext = ReturnType<typeof createHttpContext>;
