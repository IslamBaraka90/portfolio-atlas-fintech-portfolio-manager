import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { constructionRequestSchema } from "@portfolio-atlas/contracts";
import type { ConstructionService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerConstructionRoutes(
  app: FastifyInstance,
  service: ConstructionService,
  http: HttpContext,
) {
  app.get("/api/v1/targets", async (request) => http.response(service.list(), request));
  app.get("/api/v1/targets/:id", async (request) =>
    http.response(
      service.get(z.object({ id: z.string().min(1) }).parse(request.params).id),
      request,
    ),
  );
  app.post("/api/v1/targets", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.create(constructionRequestSchema.parse(request.body), http.command(request)),
          request,
        ),
      ),
  );
}
