import type { BasisDriftReport } from "@portfolio-atlas/contracts";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { actionReviewRequestSchema, adjustmentRequestSchema } from "@portfolio-atlas/contracts";
import type {
  CorporateActionService,
  AdjustmentService,
  MarketDataService,
} from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerCorporateActionRoutes(
  app: FastifyInstance,
  actions: CorporateActionService,
  adjustments: AdjustmentService,
  datasets: MarketDataService,
  http: HttpContext,
  driftLesson: BasisDriftReport,
) {
  app.get("/api/v1/corporate-actions/basis-drift-lesson", async (request) =>
    http.response(driftLesson, request),
  );
  const id = (params: unknown) => z.object({ id: z.string().min(1) }).parse(params).id;
  app.post("/api/v1/corporate-actions/reviews", async (request, reply) => {
    const result = await actions.review(
      actionReviewRequestSchema.parse(request.body),
      http.command(request),
    );
    return reply
      .code(201)
      .send(
        http.response(
          result,
          request,
          datasets.get(result.datasetId, result.datasetRevision).source,
        ),
      );
  });
  app.get("/api/v1/corporate-actions/reviews/:id", async (request) => {
    const result = actions.get(id(request.params));
    return http.response(
      result,
      request,
      datasets.get(result.datasetId, result.datasetRevision).source,
    );
  });
  app.post("/api/v1/adjustment-runs", async (request, reply) => {
    const result = adjustments.run(
      adjustmentRequestSchema.parse(request.body),
      http.command(request),
    );
    return reply
      .code(201)
      .send(
        http.response(
          result,
          request,
          datasets.get(result.datasetId, result.datasetRevision).source,
        ),
      );
  });
  app.get("/api/v1/adjustment-runs", async (request) => {
    const rows = adjustments.list(),
      sources = new Set(rows.map((row) => datasets.get(row.datasetId, row.datasetRevision).source));
    return http.response(
      rows,
      request,
      sources.size > 1 ? "mixed" : (sources.values().next().value ?? "synthetic"),
    );
  });
  app.get("/api/v1/adjustment-runs/:id", async (request) => {
    const query = z
      .strictObject({ revision: z.coerce.number().int().positive().optional() })
      .parse(request.query);
    const result = adjustments.get(id(request.params), query.revision);
    return http.response(
      result,
      request,
      datasets.get(result.datasetId, result.datasetRevision).source,
    );
  });
}
