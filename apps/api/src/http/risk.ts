import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { riskModelRequestSchema } from "@portfolio-atlas/contracts";
import type { RiskService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerRiskRoutes(app: FastifyInstance, service: RiskService, http: HttpContext) {
  app.get("/api/v1/risk-models", async (request) => http.response(service.list(), request));
  app.get("/api/v1/risk-models/:id", async (request) =>
    http.response(
      service.get(z.object({ id: z.string().min(1) }).parse(request.params).id),
      request,
    ),
  );
  app.post("/api/v1/risk-models", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.create(riskModelRequestSchema.parse(request.body), http.command(request)),
          request,
        ),
      ),
  );
}
