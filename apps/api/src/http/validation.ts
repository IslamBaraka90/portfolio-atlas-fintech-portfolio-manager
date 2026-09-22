import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { validationRequestSchema } from "@portfolio-atlas/contracts";
import type { ValidationService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerValidationRoutes(
  app: FastifyInstance,
  service: ValidationService,
  http: HttpContext,
) {
  app.get("/api/v1/validation-runs", async (request) => http.response(service.list(), request));
  app.get("/api/v1/validation-runs/:id", async (request) =>
    http.response(
      service.get(z.object({ id: z.string().min(1) }).parse(request.params).id),
      request,
    ),
  );
  app.post("/api/v1/validation-runs", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.create(validationRequestSchema.parse(request.body), http.command(request)),
          request,
        ),
      ),
  );
}
