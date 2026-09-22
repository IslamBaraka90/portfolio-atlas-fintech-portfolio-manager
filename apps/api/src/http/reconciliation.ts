import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  statementInputSchema,
  reconciliationRequestSchema,
  resolutionRequestSchema,
  proposalApprovalSchema,
} from "@portfolio-atlas/contracts";
import type { ReconciliationService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerReconciliationRoutes(
  app: FastifyInstance,
  service: ReconciliationService,
  http: HttpContext,
) {
  const params = z.object({ id: z.string().min(1) });
  app.get("/api/v1/statements", async (r) => http.response(service.statements(), r));
  app.get("/api/v1/statements/:id", async (r) =>
    http.response(
      service.statement(
        params.parse(r.params).id,
        z.object({ revision: z.coerce.number().int().positive().optional() }).parse(r.query)
          .revision,
      ),
      r,
    ),
  );
  app.get("/api/v1/reconciliations", async (r) => http.response(service.runs(), r));
  app.get("/api/v1/reconciliations/:id", async (r) =>
    http.response(service.run(params.parse(r.params).id), r),
  );
  app.get("/api/v1/resolutions", async (r) => http.response(service.resolutions(), r));
  app.post("/api/v1/statements", async (r, reply) =>
    reply
      .code(201)
      .send(http.response(service.import(statementInputSchema.parse(r.body), http.command(r)), r)),
  );
  app.post("/api/v1/reconciliations", async (r, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.create(reconciliationRequestSchema.parse(r.body), http.command(r)),
          r,
        ),
      ),
  );
  app.post("/api/v1/resolutions", async (r, reply) =>
    reply
      .code(201)
      .send(
        http.response(service.propose(resolutionRequestSchema.parse(r.body), http.command(r)), r),
      ),
  );
  app.post("/api/v1/resolutions/:id/approval", async (r, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.approve(
            params.parse(r.params).id,
            proposalApprovalSchema.parse(r.body).expectedRevision,
            http.command(r),
          ),
          r,
        ),
      ),
  );
}
