import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { companyRequestSchema, researchRequestSchema } from "@portfolio-atlas/contracts";
import type { CompanyService, ResearchService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerResearchRoutes(
  app: FastifyInstance,
  companies: CompanyService,
  research: ResearchService,
  http: HttpContext,
) {
  const id = (params: unknown) => z.object({ id: z.string().min(1) }).parse(params).id;
  const revision = (query: unknown) =>
    z.strictObject({ revision: z.coerce.number().int().positive().optional() }).parse(query)
      .revision;
  app.get("/api/v1/company-observations", async (request) => {
    const rows = companies.list(),
      sources = new Set(rows.map((r) => r.source));
    return http.response(
      rows,
      request,
      sources.size > 1 ? "mixed" : (rows[0]?.source ?? "synthetic"),
    );
  });
  app.get("/api/v1/company-observations/:id", async (request) => {
    const value = companies.get(id(request.params), revision(request.query));
    return http.response(value, request, value.source);
  });
  app.post("/api/v1/company-observations", async (request, reply) => {
    const value = await companies.ingest(
      companyRequestSchema.parse(request.body),
      http.command(request),
    );
    return reply
      .code(value.status === "ingested" ? 201 : 200)
      .send(http.response(value, request, value.observation?.source ?? "mixed"));
  });
  app.get("/api/v1/research-runs", async (request) =>
    http.response(research.list(), request, "mixed"),
  );
  app.get("/api/v1/research-runs/:id", async (request) =>
    http.response(research.get(id(request.params)), request, "mixed"),
  );
  app.post("/api/v1/research-runs", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          research.create(researchRequestSchema.parse(request.body), http.command(request)),
          request,
          "mixed",
        ),
      ),
  );
}
