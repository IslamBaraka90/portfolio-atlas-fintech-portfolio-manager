import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { aliasQuerySchema, dataModeSchema, identifierSchema } from "@portfolio-atlas/contracts";
import type { Commands, IdentityResolver, InstrumentService } from "@portfolio-atlas/core";
import { syntheticAliases } from "@portfolio-atlas/testing";
import type { HttpContext } from "./context.js";

export function registerInstrumentRoutes(
  app: FastifyInstance,
  service: InstrumentService,
  resolver: IdentityResolver,
  commands: Commands,
  http: HttpContext,
) {
  const search = z.strictObject({
    q: z.string().trim().min(1).max(80),
    mode: dataModeSchema.default("synthetic"),
  });
  app.get("/api/v1/instruments/search", async (request) => {
    const input = search.parse(request.query);
    return http.response(await service.search(input.q, input.mode), request, input.mode);
  });
  app.get("/api/v1/instruments", async (request) => {
    const records = service.list();
    const sources = new Set(records.map((item) => item.source));
    return http.response(
      records,
      request,
      sources.size > 1 ? "mixed" : (records[0]?.source ?? "synthetic"),
    );
  });
  app.get("/api/v1/instruments/:id/revisions", async (request) => {
    const id = z.object({ id: identifierSchema }).parse(request.params).id;
    return http.response(service.revisions(id), request, service.get(id).source);
  });
  app.get("/api/v1/instruments/:id", async (request) => {
    const record = service.get(z.object({ id: identifierSchema }).parse(request.params).id);
    return http.response(record, request, record.source);
  });
  app.post("/api/v1/instruments/resolutions", async (request, reply) => {
    const { candidateId } = z.strictObject({ candidateId: identifierSchema }).parse(request.body);
    const result = await service.resolve(candidateId, http.command(request));
    return reply
      .code(result.status === "resolved" ? 201 : 200)
      .send(http.response(result, request, result.source));
  });
  app.post("/api/v1/universe/evaluations", async (request, reply) => {
    const input = z
      .strictObject({
        instrumentId: identifierSchema,
        instrumentRevision: z.number().int().positive(),
        mandateId: identifierSchema,
        mandateRevision: z.number().int().positive(),
      })
      .parse(request.body);
    const result = await commands.execute(
      "universe.evaluate",
      input,
      http.command(request),
      async () => service.eligibility(input),
    );
    return reply
      .code(201)
      .send(http.response(result, request, service.get(input.instrumentId).source));
  });
  app.get("/api/v1/instruments/aliases", async (request) =>
    http.response(syntheticAliases, request),
  );
  // Read-only query: no mutation key is required for inspecting the fixed alias example.
  app.get("/api/v1/instruments/alias-resolution", async (request) =>
    http.response(
      resolver.resolve(aliasQuerySchema.parse(request.query), syntheticAliases),
      request,
    ),
  );
}
