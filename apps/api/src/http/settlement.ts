import type { FastifyInstance } from "fastify";
import { settlementPolicyInputSchema, settlementCommandSchema } from "@portfolio-atlas/contracts";
import type { SettlementService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerSettlementRoutes(
  app: FastifyInstance,
  service: SettlementService,
  http: HttpContext,
) {
  app.get("/api/v1/settlement-policies", async (request) =>
    http.response(service.policies(), request),
  );
  app.get("/api/v1/settlement-queue", async (request) => http.response(service.queue(), request));
  app.post("/api/v1/settlement-policies", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.createPolicy(
            settlementPolicyInputSchema.parse(request.body),
            http.command(request),
          ),
          request,
        ),
      ),
  );
  app.post("/api/v1/settlement-events", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.apply(settlementCommandSchema.parse(request.body), http.command(request)),
          request,
        ),
      ),
  );
}
