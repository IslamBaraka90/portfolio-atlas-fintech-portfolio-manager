import { dirname, resolve, join } from "node:path";
import { SqliteLedgerRepository } from "@portfolio-atlas/adapters";
import { LedgerService } from "@portfolio-atlas/core";
import { registerLedgerRoutes } from "./http/ledger.js";
import { FileRawArchive } from "@portfolio-atlas/adapters";
import {
  SqliteDatabase,
  SqlitePortfolioRepository,
  SqliteInstrumentRepository,
  SqliteDatasetRepository,
  SqliteActionRepository,
} from "@portfolio-atlas/adapters";
import { basisDriftLesson } from "@portfolio-atlas/adapters";
import { CorporateActionService, AdjustmentService } from "@portfolio-atlas/core";
import { ProviderActionNormalizer, FintechAdjustmentEngine } from "@portfolio-atlas/adapters";
import { registerCorporateActionRoutes } from "./http/corporate-actions.js";
import { MarketDataService, type ChartProvider, type RawArchive } from "@portfolio-atlas/core";
import {
  SyntheticChartProvider,
  YahooChartProvider,
  FintechMarketQualityValidator,
  MemoryRawArchive,
} from "@portfolio-atlas/adapters";
import { registerMarketDataRoutes } from "./http/market-data.js";
import {
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
    chartProviders?: Partial<Record<DataMode, ChartProvider>>;
    rawArchive?: RawArchive;
    databasePath?: string;
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
  // Tests default to isolated in-memory SQLite; the server supplies a durable file path.
  const database = new SqliteDatabase(options.databasePath ?? ":memory:");
  app.addHook("onClose", async () => database.close());
  const storage =
    options.databasePath && options.databasePath !== ":memory:"
      ? ("sqlite" as const)
      : ("memory" as const);
  const repository = new SqlitePortfolioRepository(database);
  const ids = options.ids ?? { next: () => randomUUID() };
  const commands = new Commands(repository, database);
  const service = new PortfolioService(repository, clock, ids, commands);
  const yahooTransport = options.yahooEnabled ? createYahooTransport() : null;
  const budget = new RequestBudget(options.yahooConcurrency ?? 2, options.yahooTimeoutMs ?? 10000);
  const providers: Partial<Record<DataMode, InstrumentProvider>> = options.instrumentProviders ?? {
    synthetic: new SyntheticInstrumentProvider(syntheticInstruments, clock),
    ...(options.yahooEnabled
      ? {
          yahoo: new YahooInstrumentProvider(yahooTransport!, clock, budget),
        }
      : {}),
  };
  const instruments = new InstrumentService(
    providers,
    new SqliteInstrumentRepository(database),
    clock,
    ids,
    commands,
    service,
  );
  let workspace = database.get("workspace", "main") as { sessionId: string } | undefined;
  if (!workspace) {
    workspace = { sessionId: randomUUID() };
    database.run(() => database.append("workspace", "main", 1, workspace));
  }
  const sessionId = workspace.sessionId;
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
  registerRoutes(app, service, clock, sessionId, storage);
  registerInstrumentRoutes(
    app,
    instruments,
    new FintechIdentityResolver(),
    commands,
    createHttpContext(clock, sessionId, storage),
  );
  const rawArchive =
    options.rawArchive ??
    (storage === "sqlite"
      ? new FileRawArchive(join(dirname(resolve(options.databasePath!)), "market-data"))
      : new MemoryRawArchive());
  const marketData = new MarketDataService(
    options.chartProviders ?? {
      synthetic: new SyntheticChartProvider(clock),
      ...(yahooTransport ? { yahoo: new YahooChartProvider(yahooTransport, clock, budget) } : {}),
    },
    new SqliteDatasetRepository(database),
    rawArchive,
    new FintechMarketQualityValidator(),
    instruments,
    clock,
    ids,
    commands,
  );
  registerMarketDataRoutes(app, marketData, createHttpContext(clock, sessionId, storage));
  const actionRepository = new SqliteActionRepository(database);
  const actions = new CorporateActionService(
    actionRepository,
    rawArchive,
    new ProviderActionNormalizer(),
    marketData,
    clock,
    ids,
    commands,
  );
  const adjustments = new AdjustmentService(
    actionRepository,
    new FintechAdjustmentEngine(),
    actions,
    marketData,
    clock,
    ids,
    commands,
  );
  registerCorporateActionRoutes(
    app,
    actions,
    adjustments,
    marketData,
    createHttpContext(clock, sessionId, storage),
    basisDriftLesson(),
  );
  registerLedgerRoutes(
    app,
    new LedgerService(
      new SqliteLedgerRepository(database),
      service,
      instruments,
      clock,
      ids,
      commands,
    ),
    createHttpContext(clock, sessionId, storage),
  );
  return app;
}
