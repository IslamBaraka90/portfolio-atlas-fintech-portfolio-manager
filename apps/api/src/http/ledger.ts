import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { postingInputSchema, correctionRequestSchema } from "@portfolio-atlas/contracts";
import type { LedgerService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerLedgerRoutes(
  app: FastifyInstance,
  ledger: LedgerService,
  http: HttpContext,
) {
  app.get("/api/v1/portfolios/:id/book", async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    return http.response(ledger.get(id), request);
  });
  app.post("/api/v1/ledger/events", async (request, reply) => {
    const result = ledger.post(postingInputSchema.parse(request.body), http.command(request));
    return reply.code(201).send(http.response(result, request));
  });
  app.post("/api/v1/ledger/corrections", async (request, reply) => {
    const result = ledger.correct(
      correctionRequestSchema.parse(request.body),
      http.command(request),
    );
    return reply.code(201).send(http.response(result, request));
  });
}
