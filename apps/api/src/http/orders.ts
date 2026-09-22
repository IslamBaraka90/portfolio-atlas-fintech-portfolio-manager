import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { paperSubmitSchema, paperEventSchema } from "@portfolio-atlas/contracts";
import type { PaperExecutionService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerOrderRoutes(
  app: FastifyInstance,
  service: PaperExecutionService,
  http: HttpContext,
) {
  const params = z.object({ id: z.string().min(1) });
  app.get("/api/v1/paper-batches", async (request) => http.response(service.list(), request));
  app.get("/api/v1/paper-batches/:id", async (request) =>
    http.response(service.get(params.parse(request.params).id), request),
  );
  app.post("/api/v1/paper-batches", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.submit(paperSubmitSchema.parse(request.body), http.command(request)),
          request,
        ),
      ),
  );
  app.post("/api/v1/paper-batches/:id/events", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.apply(
            params.parse(request.params).id,
            paperEventSchema.parse(request.body),
            http.command(request),
          ),
          request,
        ),
      ),
  );
}
