import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ingestionRequestSchema } from "@portfolio-atlas/contracts";
import type { MarketDataService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerMarketDataRoutes(
  app: FastifyInstance,
  service: MarketDataService,
  http: HttpContext,
) {
  const params = z.object({ id: z.string().min(1) });
  const query = z.strictObject({ revision: z.coerce.number().int().positive().optional() });
  app.post("/api/v1/market-data/ingestions", async (request, reply) => {
    const result = await service.ingest(
      ingestionRequestSchema.parse(request.body),
      http.command(request),
    );
    return reply
      .code(result.status === "ingested" ? 201 : 200)
      .send(http.response(result, request, result.source));
  });
  app.get("/api/v1/datasets", async (request) => {
    const rows = service.list();
    const sources = new Set(rows.map((row) => row.source));
    return http.response(
      rows,
      request,
      sources.size > 1 ? "mixed" : (rows[0]?.source ?? "synthetic"),
    );
  });
  for (const path of ["/api/v1/datasets/:id", "/api/v1/datasets/:id/quality"])
    app.get(path, async (request) => {
      const dataset = service.get(
        params.parse(request.params).id,
        query.parse(request.query).revision,
      );
      return http.response(
        path.endsWith("/quality") ? dataset.quality : dataset,
        request,
        dataset.source,
      );
    });
}
