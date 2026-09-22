import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { attributionRequestSchema } from "@portfolio-atlas/contracts";
import type { AttributionService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerAttributionRoutes(
  app: FastifyInstance,
  service: AttributionService,
  http: HttpContext,
) {
  app.get("/api/v1/attribution", async (r) => http.response(service.list(), r));
  app.get("/api/v1/attribution/:id", async (r) =>
    http.response(service.get(z.object({ id: z.string().min(1) }).parse(r.params).id), r),
  );
  app.post("/api/v1/attribution", async (r, reply) =>
    reply
      .code(201)
      .send(
        http.response(service.create(attributionRequestSchema.parse(r.body), http.command(r)), r),
      ),
  );
}
