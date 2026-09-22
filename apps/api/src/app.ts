import { SqliteRecovery } from "@portfolio-atlas/adapters";
import { registerRecoveryRoutes } from "./http/recovery.js";
import { AccessControl } from "./security/access.js";
import type { AccessConfig } from "@portfolio-atlas/contracts";
import { ReportService } from "@portfolio-atlas/core";
import { registerReportRoutes } from "./http/reports.js";
import { AttributionService } from "@portfolio-atlas/core";
import { registerAttributionRoutes } from "./http/attribution.js";
import { PerformanceService } from "@portfolio-atlas/core";
import { registerPerformanceRoutes } from "./http/performance.js";
import { MonitorService } from "@portfolio-atlas/core";
import { FintechMonitorAnalytics } from "@portfolio-atlas/adapters";
import { registerMonitorRoutes } from "./http/monitoring.js";
import { ReconciliationService } from "@portfolio-atlas/core";
import { registerReconciliationRoutes } from "./http/reconciliation.js";
import { SettlementService } from "@portfolio-atlas/core";
import { registerSettlementRoutes } from "./http/settlement.js";
import { PaperExecutionService } from "@portfolio-atlas/core";
import { FintechPaperExecutionAnalytics } from "@portfolio-atlas/adapters";
import { registerOrderRoutes } from "./http/orders.js";
import { RebalanceService } from "@portfolio-atlas/core";
import { FintechLotScoringEngine } from "@portfolio-atlas/adapters";
import { registerRebalanceRoutes } from "./http/rebalancing.js";
import { ValidationService } from "@portfolio-atlas/core";
import { FintechDrawdownEngine } from "@portfolio-atlas/adapters";
import { historicalFixture } from "@portfolio-atlas/testing";
import { registerValidationRoutes } from "./http/validation.js";
import { ConstructionService } from "@portfolio-atlas/core";
import { FintechConstructionEngine } from "@portfolio-atlas/adapters";
import { registerConstructionRoutes } from "./http/construction.js";
import { RiskService } from "@portfolio-atlas/core";
import { FintechRiskEngine } from "@portfolio-atlas/adapters";
import { registerRiskRoutes } from "./http/risk.js";
import { CompanyService, ResearchService } from "@portfolio-atlas/core";
import {
  SyntheticCompanyProvider,
  YahooCompanyProvider,
  FintechResearchEngine,
} from "@portfolio-atlas/adapters";
import { registerResearchRoutes } from "./http/research.js";
import { SqliteSnapshotRepository, FintechBenchmarkEngine } from "@portfolio-atlas/adapters";
import { ValuationService, BenchmarkService } from "@portfolio-atlas/core";
import { registerValuationRoutes } from "./http/valuation.js";
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
import Fastify, { LogController } from "fastify";
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
    accessConfig?: AccessConfig;
    secureCookie?: boolean;
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
    logger: options.logger
      ? { redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"] }
      : false,
    logController: new LogController({ disableRequestLogging: true }),
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
  let access: AccessControl;
  try {
    access = new AccessControl(database, clock, options.accessConfig, options.secureCookie);
  } catch (error) {
    database.close();
    throw error;
  }
  const commands = new Commands(repository, database, access);
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
    if (error instanceof ApplicationError) {
      if (error.code === "ACCESS_DENIED")
        access.record({
          operation: request.method + " " + (request.routeOptions.url ?? "unknown"),
          principal: request.principal,
          requestId: request.id,
          decision: "denied",
          reason: error.message,
        });
      return reply
        .code(error.code === "ACCESS_DENIED" ? 403 : error.code === "NOT_FOUND" ? 404 : 409)
        .send({
          error: { code: error.code, message: error.message, fields: [] },
          requestId: request.id,
        });
    }
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
  access.register(app, createHttpContext(clock, sessionId, storage));
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
  const ledger = new LedgerService(
    new SqliteLedgerRepository(database),
    service,
    instruments,
    clock,
    ids,
    commands,
  );
  registerLedgerRoutes(app, ledger, createHttpContext(clock, sessionId, storage));
  const snapshots = new SqliteSnapshotRepository(database);
  const valuations = new ValuationService(
    snapshots,
    ledger,
    service,
    marketData,
    actions,
    adjustments,
    clock,
    ids,
    commands,
  );
  const benchmarks = new BenchmarkService(
    snapshots,
    new FintechBenchmarkEngine(),
    adjustments,
    marketData,
    clock,
    ids,
    commands,
  );
  registerValuationRoutes(
    app,
    valuations,
    benchmarks,
    createHttpContext(clock, sessionId, storage),
  );
  const companies = new CompanyService(
    {
      synthetic: new SyntheticCompanyProvider(clock),
      ...(yahooTransport ? { yahoo: new YahooCompanyProvider(yahooTransport, clock, budget) } : {}),
    },
    snapshots,
    rawArchive,
    instruments,
    clock,
    ids,
    commands,
  );
  const research = new ResearchService(
    snapshots,
    new FintechResearchEngine(),
    marketData,
    adjustments,
    companies,
    clock,
    ids,
    commands,
  );
  registerResearchRoutes(app, companies, research, createHttpContext(clock, sessionId, storage));
  const risk = new RiskService(
    snapshots,
    new FintechRiskEngine(),
    adjustments,
    marketData,
    clock,
    ids,
    commands,
  );
  registerRiskRoutes(app, risk, createHttpContext(clock, sessionId, storage));
  const construction = new ConstructionService(
    snapshots,
    new FintechConstructionEngine(),
    service,
    risk,
    valuations,
    marketData,
    clock,
    ids,
    commands,
  );
  registerConstructionRoutes(app, construction, createHttpContext(clock, sessionId, storage));
  const validation = new ValidationService(
    snapshots,
    { get: historicalFixture },
    new FintechDrawdownEngine(),
    marketData,
    clock,
    ids,
    commands,
  );
  registerValidationRoutes(app, validation, createHttpContext(clock, sessionId, storage));
  const rebalances = new RebalanceService(
    snapshots,
    construction,
    valuations,
    ledger,
    service,
    instruments,
    new FintechLotScoringEngine(),
    clock,
    ids,
    commands,
  );
  registerRebalanceRoutes(app, rebalances, createHttpContext(clock, sessionId, storage));
  const settlements = new SettlementService(snapshots, ledger, service, clock, ids, commands);
  registerSettlementRoutes(app, settlements, createHttpContext(clock, sessionId, storage));
  const paper = new PaperExecutionService(
    snapshots,
    rebalances,
    ledger,
    service,
    instruments,
    new FintechPaperExecutionAnalytics(),
    settlements,
    clock,
    ids,
    commands,
  );
  ledger.setManualWriteGuard((id) => {
    paper.assertManualWriteAllowed(id);
    settlements.assertManualWriteAllowed(id);
  });
  registerOrderRoutes(app, paper, createHttpContext(clock, sessionId, storage));
  registerReconciliationRoutes(
    app,
    new ReconciliationService(snapshots, ledger, service, clock, ids, commands),
    createHttpContext(clock, sessionId, storage),
  );
  registerMonitorRoutes(
    app,
    new MonitorService(
      snapshots,
      valuations,
      risk,
      construction,
      service,
      instruments,
      ledger,
      new FintechMonitorAnalytics(),
      clock,
      ids,
      commands,
    ),
    createHttpContext(clock, sessionId, storage),
  );
  const performance = new PerformanceService(
    snapshots,
    valuations,
    ledger,
    benchmarks,
    clock,
    ids,
    commands,
  );
  registerPerformanceRoutes(app, performance, createHttpContext(clock, sessionId, storage));
  registerAttributionRoutes(
    app,
    new AttributionService(snapshots, performance, clock, ids, commands),
    createHttpContext(clock, sessionId, storage),
  );
  registerReportRoutes(
    app,
    new ReportService(snapshots, service, ledger, clock, ids, commands),
    createHttpContext(clock, sessionId, storage),
  );
  registerRecoveryRoutes(
    app,
    database,
    storage === "sqlite" && !options.rawArchive
      ? new SqliteRecovery(database, dirname(resolve(options.databasePath!)))
      : null,
    commands,
    clock,
    createHttpContext(clock, sessionId, storage),
  );
  return app;
}
