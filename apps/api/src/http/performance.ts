import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { performanceRequestSchema } from "@portfolio-atlas/contracts";
import type { PerformanceService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerPerformanceRoutes(
  app: FastifyInstance,
  service: PerformanceService,
  http: HttpContext,
) {
  const params = z.object({ id: z.string().min(1) });
  app.get("/api/v1/performance", async (r) => http.response(service.list(), r));
  app.get("/api/v1/performance/:id", async (r) =>
    http.response(service.get(params.parse(r.params).id), r),
  );
  app.post("/api/v1/performance", async (r, reply) =>
    reply
      .code(201)
      .send(
        http.response(service.create(performanceRequestSchema.parse(r.body), http.command(r)), r),
      ),
  );
}
