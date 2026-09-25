import type { FastifyInstance } from "fastify";
import type { ServerResponse } from "node:http";
import { z } from "zod";
import {
  liveIntervalSchema,
  providerSymbolSchema,
  watchlistChangeSchema,
  type LiveEvent,
} from "@portfolio-atlas/contracts";
import type { LiveHistoryService, LiveRefreshService, QuoteService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";

export function registerLiveRoutes(
  app: FastifyInstance,
  service: LiveRefreshService,
  quotes: QuoteService,
  history: LiveHistoryService,
  http: HttpContext,
) {
  const mode = service.policy.mode === "live" ? ("yahoo" as const) : ("synthetic" as const);
  const params = z.object({ id: z.string().min(1) });
  app.get("/api/v1/live/status", async (r) => http.response(service.status(), r, mode));
  app.get("/api/v1/live/cycles", async (r) => http.response(service.cycles(), r, mode));
  app.get("/api/v1/live/cycles/:id", async (r) =>
    http.response(service.get(params.parse(r.params).id), r, mode),
  );
  app.post("/api/v1/live/cycles", async (r, reply) =>
    reply.code(201).send(http.response(await service.refreshNow(http.command(r)), r, mode)),
  );

  app.get("/api/v1/live/quotes", async (r) => http.response(quotes.board(), r, mode));
  app.get("/api/v1/live/quotes/:symbol", async (r) =>
    http.response(
      quotes.tape(providerSymbolSchema.parse((r.params as { symbol: string }).symbol)),
      r,
      mode,
    ),
  );
  app.get("/api/v1/live/watchlist", async (r) => http.response(quotes.watchlist(), r, mode));
  app.post("/api/v1/live/watchlist", async (r, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          quotes.changeWatchlist(watchlistChangeSchema.parse(r.body), http.command(r)),
          r,
          mode,
        ),
      ),
  );

  app.get("/api/v1/live/series", async (r) => http.response(history.series(), r, mode));
  const barParams = z.object({ symbol: providerSymbolSchema, interval: liveIntervalSchema });
  const barQuery = z.object({ limit: z.coerce.number().int().min(1).max(2000).default(500) });
  app.get("/api/v1/live/series/:symbol/:interval/bars", async (r) => {
    const { symbol, interval } = barParams.parse(r.params);
    return http.response(
      {
        series: history.head(symbol, interval) ?? null,
        bars: history.bars(symbol, interval, barQuery.parse(r.query).limit),
      },
      r,
      mode,
    );
  });

  // Server-sent events: the browser never polls Yahoo; it hears completed cycles.
  // Open streams are ended before the server closes so shutdown is not blocked.
  const streams = new Set<ServerResponse>();
  app.addHook("preClose", async () => {
    for (const stream of streams) stream.end();
  });
  app.get("/api/v1/live/stream", (request, reply) => {
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    const send = (event: LiveEvent) =>
      raw.write("event: " + event.type + "\ndata: " + JSON.stringify(event.data) + "\n\n");
    send({ type: "status", data: service.status() });
    const unsubscribe = service.subscribe(send);
    const ping = setInterval(() => raw.write(": keep-alive\n\n"), 25_000);
    ping.unref();
    streams.add(raw);
    request.raw.on("close", () => {
      unsubscribe();
      clearInterval(ping);
      streams.delete(raw);
    });
  });
}
