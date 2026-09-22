import type { FastifyRequest } from "fastify";
import { z } from "zod";
import type { ApiEnvelope, DataMode } from "@portfolio-atlas/contracts";
import type { Clock } from "@portfolio-atlas/core";

const keySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export function createHttpContext(clock: Clock, sessionId: string) {
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
          storage: "memory",
          sessionId,
          generatedAt: clock.now(),
        },
        requestId: request.id,
      };
    },
    command(request: FastifyRequest) {
      return { key: keySchema.parse(request.headers["idempotency-key"]), requestId: request.id };
    },
  };
}
export type HttpContext = ReturnType<typeof createHttpContext>;
