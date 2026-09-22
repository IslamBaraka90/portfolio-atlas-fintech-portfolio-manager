import {
  MemoryInstrumentRepository,
  SyntheticInstrumentProvider,
  YahooInstrumentProvider,
  createYahooTransport,
  FintechIdentityResolver,
  RequestBudget,
} from "@portfolio-atlas/adapters";
import { Commands, InstrumentService } from "@portfolio-atlas/core";
import type { InstrumentProvider } from "@portfolio-atlas/core";
import type { DataMode } from "@portfolio-atlas/contracts";
import { syntheticInstruments } from "@portfolio-atlas/testing";
import { createHttpContext } from "./http/context.js";
import { registerInstrumentRoutes } from "./http/instruments.js";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { ZodError } from "zod";
import { MemoryPortfolioRepository } from "@portfolio-atlas/adapters";
import {
  ApplicationError,
  PortfolioService,
  type Clock,
  type IdFactory,
} from "@portfolio-atlas/core";
import { registerRoutes } from "./http/routes.js";

// Construction is separate from listening, so HTTP behavior can be tested with inject().
export function buildApp(
  options: {
    logger?: boolean;
    clock?: Clock;
    ids?: IdFactory;
    allowedOrigin?: string;
    yahooEnabled?: boolean;
    yahooTimeoutMs?: number;
    yahooConcurrency?: number;
    instrumentProviders?: Partial<Record<DataMode, InstrumentProvider>>;
  } = {},
) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 128_000,
    genReqId: () => randomUUID(),
  });
  const clock = options.clock ?? { now: () => new Date().toISOString() };
  // Composition is the only place HTTP, application rules and storage are joined.
  // Every app owns a fresh memory store; tests inject deterministic clocks and IDs.
  const repository = new MemoryPortfolioRepository();
  const ids = options.ids ?? { next: () => randomUUID() };
  const commands = new Commands(repository);
  const service = new PortfolioService(repository, clock, ids, commands);
  const providers: Partial<Record<DataMode, InstrumentProvider>> = options.instrumentProviders ?? {
    synthetic: new SyntheticInstrumentProvider(syntheticInstruments, clock),
    ...(options.yahooEnabled
      ? {
          yahoo: new YahooInstrumentProvider(
            createYahooTransport(),
            clock,
            new RequestBudget(options.yahooConcurrency ?? 2, options.yahooTimeoutMs ?? 10000),
          ),
        }
      : {}),
  };
  const instruments = new InstrumentService(
    providers,
    new MemoryInstrumentRepository(),
    clock,
    ids,
    commands,
    service,
  );
  const sessionId = randomUUID();
  const allowedOrigins = new Set([
    options.allowedOrigin ?? "http://127.0.0.1:5173",
    "http://localhost:5173",
  ]);
  app.addHook("onRequest", async (request, reply) => {
    const origin = request.headers.origin;
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      origin &&
      !allowedOrigins.has(origin)
    ) {
      return reply.code(403).send({
        error: {
          code: "ORIGIN_DENIED",
          message: "Use the local learning app to submit browser commands.",
          fields: [],
        },
        requestId: request.id,
      });
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: {
          code: "INVALID_INPUT",
          message: "Check the submitted fields.",
          fields: error.issues.map((issue) => ({
            path: issue.path.join(".") || "request",
            message: issue.message,
          })),
        },
        requestId: request.id,
      });
    }
    if (error instanceof ApplicationError)
      return reply.code(error.code === "NOT_FOUND" ? 404 : 409).send({
        error: { code: error.code, message: error.message, fields: [] },
        requestId: request.id,
      });
    const status =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    if (status >= 500) request.log.error(error);
    return reply.code(status).send({
      error: {
        code: status >= 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST",
        message:
          status >= 500
            ? "The server could not complete this request."
            : "The HTTP request could not be read.",
        fields: [],
      },
      requestId: request.id,
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: { code: "NOT_FOUND", message: "Route not found.", fields: [] },
      requestId: request.id,
    }),
  );
  registerRoutes(app, service, clock, sessionId);
  registerInstrumentRoutes(
    app,
    instruments,
    new FintechIdentityResolver(),
    commands,
    createHttpContext(clock, sessionId),
  );
  return app;
}
