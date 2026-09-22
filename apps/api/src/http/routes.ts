import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  evaluationRequestSchema,
  identifierSchema,
  mandateInputSchema,
  mandateUpdateSchema,
  portfolioInputSchema,
  type ApiEnvelope,
} from "@portfolio-atlas/contracts";
import type { Clock, PortfolioService } from "@portfolio-atlas/core";
import { balancedAllocation, concentratedAllocation, demoMandate } from "@portfolio-atlas/testing";

const routeIdSchema = z.strictObject({ id: identifierSchema });
const keySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export function registerRoutes(
  app: FastifyInstance,
  service: PortfolioService,
  clock: Clock,
  sessionId: string,
) {
  function response<T>(data: T, request: FastifyRequest): ApiEnvelope<T> {
    return {
      data,
      metadata: {
        schemaVersion: "1",
        mode: "synthetic",
        storage: "memory",
        sessionId,
        generatedAt: clock.now(),
      },
      requestId: request.id,
    };
  }
  function command(request: FastifyRequest) {
    return { key: keySchema.parse(request.headers["idempotency-key"]), requestId: request.id };
  }
  const id = (request: FastifyRequest) => routeIdSchema.parse(request.params).id;

  app.get("/api/v1/health", async () => ({
    name: "Portfolio Atlas",
    chapter: 1,
    mode: "synthetic",
    storage: "memory",
    sessionId,
  }));
  app.get("/api/v1/lesson", async (request) => {
    const lowCash = structuredClone(balancedAllocation);
    lowCash.cashWeight = 0.05;
    lowCash.positions[2]!.weight = 0.25;
    const missingSector = structuredClone(balancedAllocation);
    missingSector.positions[0]!.sector = null;
    return response(
      {
        mandate: demoMandate,
        scenarios: [
          { id: "balanced", label: "Balanced", allocation: balancedAllocation },
          { id: "concentrated", label: "Concentrated", allocation: concentratedAllocation },
          { id: "low-cash", label: "Low cash", allocation: lowCash },
          { id: "missing-sector", label: "Missing sector", allocation: missingSector },
          {
            id: "invalid-total",
            label: "110% total",
            allocation: { ...balancedAllocation, cashWeight: 0.2 },
          },
        ],
      },
      request,
    );
  });
  app.get("/api/v1/mandates", async (request) => response(service.listMandates(), request));
  app.get("/api/v1/mandates/:id", async (request) =>
    response(service.getMandate(id(request)), request),
  );
  app.get("/api/v1/mandates/:id/revisions", async (request) =>
    response(service.revisions(id(request)), request),
  );
  app.post("/api/v1/mandates", async (request, reply) => {
    const result = service.createMandate(mandateInputSchema.parse(request.body), command(request));
    return reply.code(201).send(response(result, request));
  });
  app.put("/api/v1/mandates/:id", async (request) => {
    const input = mandateUpdateSchema.parse(request.body);
    return response(
      service.updateMandate(id(request), input.expectedRevision, input.mandate, command(request)),
      request,
    );
  });
  app.get("/api/v1/portfolios", async (request) => response(service.listPortfolios(), request));
  app.get("/api/v1/portfolios/:id", async (request) =>
    response(service.getPortfolio(id(request)), request),
  );
  app.post("/api/v1/portfolios", async (request, reply) => {
    const result = service.createPortfolio(
      portfolioInputSchema.parse(request.body),
      command(request),
    );
    return reply.code(201).send(response(result, request));
  });
  app.post("/api/v1/mandates/:id/evaluations", async (request, reply) => {
    const input = evaluationRequestSchema.parse(request.body);
    const result = service.evaluate(
      id(request),
      input.expectedRevision,
      input.allocation,
      command(request),
    );
    return reply.code(201).send(response(result, request));
  });
  app.get("/api/v1/evaluations/:id", async (request) =>
    response(service.getEvaluation(id(request)), request),
  );
  app.get("/api/v1/audit-events", async (request) => response(service.audit(), request));
}
