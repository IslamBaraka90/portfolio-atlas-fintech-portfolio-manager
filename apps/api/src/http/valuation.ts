import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  valuationRequestSchema,
  benchmarkDefinitionInputSchema,
  returnBasisSchema,
  currencySchema,
} from "@portfolio-atlas/contracts";
import {
  compareBenchmark,
  type ValuationService,
  type BenchmarkService,
} from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerValuationRoutes(
  app: FastifyInstance,
  valuations: ValuationService,
  benchmarks: BenchmarkService,
  http: HttpContext,
) {
  const id = (params: unknown) => z.object({ id: z.string().min(1) }).parse(params).id;
  app.get("/api/v1/valuations", async (request) => http.response(valuations.list(), request));
  app.get("/api/v1/valuations/:id", async (request) =>
    http.response(valuations.get(id(request.params)), request),
  );
  app.post("/api/v1/valuations", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          valuations.create(valuationRequestSchema.parse(request.body), http.command(request)),
          request,
        ),
      ),
  );
  app.get("/api/v1/benchmark-definitions", async (request) =>
    http.response(benchmarks.definitions(), request),
  );
  app.get("/api/v1/benchmark-definitions/:id", async (request) =>
    http.response(benchmarks.definition(id(request.params)), request),
  );
  app.post("/api/v1/benchmark-definitions", async (request, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          benchmarks.define(
            benchmarkDefinitionInputSchema.parse(request.body),
            http.command(request),
          ),
          request,
        ),
      ),
  );
  app.get("/api/v1/benchmarks", async (request) => http.response(benchmarks.list(), request));
  app.get("/api/v1/benchmarks/:id", async (request) =>
    http.response(benchmarks.get(id(request.params)), request),
  );
  app.post("/api/v1/benchmarks", async (request, reply) => {
    const { definitionId } = z
      .strictObject({ definitionId: z.string().min(1) })
      .parse(request.body);
    return reply
      .code(201)
      .send(http.response(benchmarks.calculate(definitionId, http.command(request)), request));
  });
  app.get("/api/v1/benchmarks/:id/comparison", async (request) => {
    const { basis, currency } = z
      .strictObject({ basis: returnBasisSchema, currency: currencySchema })
      .parse(request.query);
    return http.response(
      compareBenchmark(benchmarks.get(id(request.params)), basis, currency),
      request,
    );
  });
}
