import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { monitorRequestSchema, findingActionSchema } from "@portfolio-atlas/contracts";
import type { MonitorService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerMonitorRoutes(
  app: FastifyInstance,
  service: MonitorService,
  http: HttpContext,
) {
  const params = z.object({ id: z.string().min(1) });
  app.get("/api/v1/monitors", async (r) => http.response(service.list(), r));
  app.get("/api/v1/monitors/:id", async (r) =>
    http.response(service.get(params.parse(r.params).id), r),
  );
  app.get("/api/v1/risk-findings", async (r) => http.response(service.findings(), r));
  app.post("/api/v1/monitors", async (r, reply) =>
    reply
      .code(201)
      .send(http.response(service.create(monitorRequestSchema.parse(r.body), http.command(r)), r)),
  );
  app.post("/api/v1/risk-findings/:id/actions", async (r, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.act(
            params.parse(r.params).id,
            findingActionSchema.parse(r.body),
            http.command(r),
          ),
          r,
        ),
      ),
  );
}
