import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { rebalanceRequestSchema, proposalApprovalSchema } from "@portfolio-atlas/contracts";
import type { RebalanceService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerRebalanceRoutes(
  app: FastifyInstance,
  service: RebalanceService,
  http: HttpContext,
) {
  const params = z.object({ id: z.string().min(1) });
  app.get("/api/v1/rebalances", async (request) => http.response(service.list(), request));
  app.get("/api/v1/rebalances/:id", async (request) =>
    http.response(
      service.get(
        params.parse(request.params).id,
        z.object({ revision: z.coerce.number().int().positive().optional() }).parse(request.query)
          .revision,
      ),
      request,
    ),
  );
  app.post("/api/v1/rebalances", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.create(rebalanceRequestSchema.parse(request.body), http.command(request)),
          request,
        ),
      ),
  );
  app.post("/api/v1/rebalances/:id/approval", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.approve(
            params.parse(request.params).id,
            proposalApprovalSchema.parse(request.body).expectedRevision,
            http.command(request),
          ),
          request,
        ),
      ),
  );
}
