import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  accessConfigSchema,
  actorSchema,
  governanceAuditSchema,
  type AccessConfig,
  type Actor,
  type Role,
} from "@portfolio-atlas/contracts";
import type { SqliteDatabase } from "@portfolio-atlas/adapters";
import { ApplicationError, type Clock, type CommandContext } from "@portfolio-atlas/core";
import type { HttpContext } from "../http/context.js";

export interface Principal {
  actor: Actor;
  policyRevision: string;
  local: boolean;
}
declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
  }
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const safe = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const bodyRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const analystRoutes = new Set([
  "/mandates",
  "/mandates/:id",
  "/mandates/:id/evaluations",
  "/universe/evaluations",
  "/valuations",
  "/benchmark-definitions",
  "/benchmarks",
  "/research-runs",
  "/risk-models",
  "/targets",
  "/validation-runs",
  "/rebalances",
  "/monitors",
  "/performance",
  "/attribution",
  "/reports",
]);
const operatorRoutes = new Set([
  "/portfolios",
  "/instruments/resolutions",
  "/market-data/ingestions",
  "/corporate-actions/reviews",
  "/adjustment-runs",
  "/company-observations",
  "/ledger/events",
  "/paper-batches",
  "/paper-batches/:id/events",
  "/settlement-policies",
  "/settlement-events",
  "/statements",
  "/reconciliations",
  "/resolutions",
  "/live/cycles",
]);
const approverRoutes = new Set([
  "/rebalances/:id/approval",
  "/resolutions/:id/approval",
  "/reports/:id/approval",
  "/ledger/corrections",
  "/governance/backups",
  "/governance/backups/:id/restore",
]);
export function requiredRole(route: string, body: unknown): Role | null {
  const input = bodyRecord(body);
  if (route === "/valuations" && Array.isArray(input.overrides) && input.overrides.length)
    return "approver";
  if (route === "/risk-findings/:id/actions")
    return input.action === "resolve" ? "approver" : "operator";
  if (approverRoutes.has(route)) return "approver";
  if (analystRoutes.has(route)) return "analyst";
  if (operatorRoutes.has(route)) return "operator";
  return null;
}

export class AccessControl {
  private readonly config: AccessConfig | undefined;
  private readonly sessions = new Map<string, { actorId: string; expires: number; csrf: string }>();
  readonly scopeId: string;
  readonly policyRevision: string;
  constructor(
    private readonly db: SqliteDatabase,
    private readonly clock: Clock,
    config?: AccessConfig,
    private readonly secureCookie = false,
  ) {
    this.config = config ? accessConfigSchema.parse(config) : undefined;
    const binding = db.get("security-scope", "main") as { scopeId: string } | undefined;
    if (binding && (!this.config || binding.scopeId !== this.config.scopeId))
      throw new Error("Configured workspace cannot change scope or fall back to local-owner mode.");
    this.scopeId = this.config?.scopeId ?? "local-workspace";
    this.policyRevision = this.config?.policyRevision ?? "chapter-17.local-owner.v1";
    if (this.config && !binding)
      db.run(() => db.append("security-scope", "main", 1, { scopeId: this.scopeId }));
  }
  private current(actorId: string): Principal | undefined {
    const c = this.config,
      now = Date.parse(this.clock.now());
    if (!c || now < Date.parse(c.validFrom) || now >= Date.parse(c.validTo)) return;
    const grant = c.actors.find((a) => a.id === actorId);
    if (!grant || now < Date.parse(grant.validFrom) || now >= Date.parse(grant.validTo)) return;
    return {
      actor: actorSchema.parse({
        id: grant.id,
        name: grant.name,
        scopeId: grant.scopeId,
        roles: grant.roles,
      }),
      policyRevision: c.policyRevision,
      local: false,
    };
  }
  private bearer(request: FastifyRequest) {
    const token = request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/)?.[1];
    if (!token) return;
    const digest = hash(token);
    const grant = this.config?.actors.find((a) => safe(a.tokenHash, digest));
    return grant ? this.current(grant.id) : undefined;
  }
  private cookieId(request: FastifyRequest) {
    return request.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("atlas_session="))
      ?.slice(14);
  }
  private identity(request: FastifyRequest) {
    if (!this.config)
      return {
        actor: {
          id: "local-owner",
          name: "Local OS owner",
          scopeId: this.scopeId,
          roles: ["reader", "analyst", "operator", "approver"] as Role[],
        },
        policyRevision: this.policyRevision,
        local: true,
      };
    // An explicit invalid credential must never silently fall back to a cookie.
    if (request.headers.authorization !== undefined) return this.bearer(request);
    const session = this.sessions.get(this.cookieId(request) ?? "");
    if (!session || session.expires <= Date.parse(this.clock.now())) return;
    return this.current(session.actorId);
  }
  private deny(request: FastifyRequest, reply: FastifyReply, status: number, reason: string) {
    this.record({
      operation: request.method + " " + (request.routeOptions.url ?? "unknown"),
      principal: request.principal,
      requestId: request.id,
      decision: "denied",
      reason,
    });
    return reply.code(status).send({
      error: {
        code: status === 401 ? "AUTH_REQUIRED" : "ACCESS_DENIED",
        message: reason,
        fields: [],
      },
      requestId: request.id,
    });
  }
  register(app: FastifyInstance, http: HttpContext) {
    app.addHook("onRequest", async (_r, reply) => {
      reply.header("cache-control", "no-store").header("x-content-type-options", "nosniff");
    });
    app.addHook("preHandler", async (request, reply) => {
      const route = (request.routeOptions.url ?? "").replace("/api/v1", "");
      const principal = this.identity(request);
      if (principal) request.principal = principal;
      if (route === "/health") return;
      if (route === "/auth/session" && request.method === "GET") return;
      if (!principal)
        return this.deny(request, reply, 401, "A current workspace session is required.");
      if (principal.actor.scopeId !== this.scopeId)
        return this.deny(request, reply, 403, "Workspace scope denied.");
      if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
      if (!principal.local && !request.headers.authorization && route !== "/auth/session") {
        const session = this.sessions.get(this.cookieId(request) ?? "");
        if (!session || !safe(String(request.headers["x-csrf-token"] ?? ""), session.csrf))
          return this.deny(request, reply, 403, "Session CSRF token is missing or invalid.");
      }
      if (route === "/auth/session") {
        if (!principal.local && !this.bearer(request))
          return this.deny(
            request,
            reply,
            401,
            "Use a provisioned bearer credential to start a session.",
          );
        return;
      }
      if (route === "/auth/logout") return;
      const role = requiredRole(route, request.body);
      if (!role || (!principal.local && !principal.actor.roles.includes(role)))
        return this.deny(request, reply, 403, "This role cannot perform the requested action.");
      const input = bodyRecord(request.body);
      // Submitted actor display text is descriptive in older lessons; configured mode binds it.
      if (!principal.local && "actor" in input) input.actor = principal.actor.name;
    });
    app.get("/api/v1/auth/session", async (r) => {
      const p = r.principal,
        session = this.sessions.get(this.cookieId(r) ?? "");
      return http.response(
        {
          mode: this.config ? "configured_sessions" : "local_owner",
          actor: p?.actor.scopeId === this.scopeId ? p.actor : null,
          policyRevision: this.policyRevision,
          csrf: p && session ? session.csrf : null,
          expiresAt: p && session ? new Date(session.expires).toISOString() : null,
        },
        r,
      );
    });
    app.post("/api/v1/auth/session", async (r, reply) => {
      const p = r.principal!;
      if (!p.local) {
        for (const [id, s] of this.sessions)
          if (s.expires <= Date.parse(this.clock.now())) this.sessions.delete(id);
        if (this.sessions.size >= 1000)
          return this.deny(r, reply, 429, "Session capacity reached.");
        const old = this.cookieId(r);
        if (old) this.sessions.delete(old);
        const id = randomBytes(32).toString("base64url"),
          csrf = randomBytes(32).toString("base64url");
        const expires = Date.parse(this.clock.now()) + 30 * 60 * 1000;
        this.sessions.set(id, { actorId: p.actor.id, expires, csrf });
        reply.header(
          "set-cookie",
          "atlas_session=" +
            id +
            "; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=1800" +
            (this.secureCookie ? "; Secure" : ""),
        );
        return http.response(
          {
            mode: "configured_sessions",
            actor: p.actor,
            policyRevision: this.policyRevision,
            csrf,
            expiresAt: new Date(expires).toISOString(),
          },
          r,
        );
      }
      return http.response(
        {
          mode: "local_owner",
          actor: p.actor,
          policyRevision: this.policyRevision,
          csrf: null,
          expiresAt: null,
        },
        r,
      );
    });
    app.post("/api/v1/auth/logout", async (r, reply) => {
      const id = this.cookieId(r);
      if (id) this.sessions.delete(id);
      reply.header(
        "set-cookie",
        "atlas_session=; Path=/api/v1; HttpOnly; SameSite=Strict; Max-Age=0" +
          (this.secureCookie ? "; Secure" : ""),
      );
      return http.response({ loggedOut: true }, r);
    });
    app.get("/api/v1/governance/audit", async (r) =>
      http.response(
        this.db
          .all("governance-audit")
          .map((v) => governanceAuditSchema.parse(v))
          .slice(-500)
          .reverse(),
        r,
      ),
    );
    app.get("/api/v1/governance/approvals", async (r) =>
      http.response(this.inbox(r.principal!), r),
    );
  }
  private creator(kind: string, id: string, revision: number) {
    return this.db.get("creator", kind + ":" + id + ":" + revision) as
      { actorId: string; scopeId: string; local: boolean } | undefined;
  }
  inbox(principal: Principal) {
    return (["rebalance", "resolution", "report"] as const).flatMap((kind) =>
      this.db
        .all(kind)
        .map(bodyRecord)
        .filter((v) => ["ready", "proposed", "draft"].includes(String(v.status)))
        .map((v) => {
          const creator = this.creator(kind, String(v.id), Number(v.revision));
          const creatorId = creator?.actorId ?? null;
          const canApprove =
            principal.local ||
            (principal.actor.roles.includes("approver") &&
              creatorId !== null &&
              creator?.local === false &&
              creator.scopeId === this.scopeId &&
              creatorId !== principal.actor.id);
          return {
            kind,
            id: String(v.id),
            revision: Number(v.revision),
            creatorId,
            canApprove,
            reason: canApprove
              ? "Review the evidence before approval."
              : creatorId === principal.actor.id
                ? "Another actor must approve this revision."
                : "Approval authority or creator evidence is missing.",
          };
        }),
    );
  }
  before = (operation: string, input: unknown, context: CommandContext) => {
    const p = context.principal;
    if (!p) return; // Direct domain fixtures have no HTTP authority; the server always supplies it.
    if (!p.local && (!this.current(p.actor.id) || p.actor.scopeId !== this.scopeId))
      throw new ApplicationError("ACCESS_DENIED", "Authority expired before command commit.");
    const kind = (
      {
        "rebalance.approve": "rebalance",
        "resolution.approve": "resolution",
        "report.approve": "report",
      } as Record<string, string>
    )[operation];
    if (kind && !p.local) {
      const data = bodyRecord(input),
        creator = this.creator(kind, String(data.id), Number(data.expectedRevision));
      if (
        !p.actor.roles.includes("approver") ||
        !creator ||
        creator.local !== false ||
        creator.scopeId !== this.scopeId ||
        creator.actorId === p.actor.id
      )
        throw new ApplicationError(
          "ACCESS_DENIED",
          "Another authenticated actor must approve this revision; creator evidence is required.",
        );
    }
  };
  after = (operation: string, input: unknown, result: unknown, context: CommandContext) => {
    const p = context.principal;
    if (!p) return;
    const data = bodyRecord(result),
      request = bodyRecord(input);
    const kind = (
      {
        "rebalance.create": "rebalance",
        "resolution.propose": "resolution",
        "report.create": "report",
      } as Record<string, string>
    )[operation];
    if (kind && typeof data.id === "string")
      this.db.append("creator", kind + ":" + data.id + ":" + data.revision, 1, {
        actorId: p.actor.id,
        scopeId: p.actor.scopeId,
        local: p.local,
      });
    const overrides: { instrumentId: string; prior: unknown; next: unknown; reason: string }[] = [];
    if (operation === "valuation.create" && Array.isArray(request.overrides)) {
      const prior = this.db
        .all("valuation")
        .map(bodyRecord)
        .filter(
          (v) => v.id !== data.id && bodyRecord(v.request).portfolioId === request.portfolioId,
        )
        .at(-1);
      for (const raw of request.overrides) {
        const o = bodyRecord(raw),
          positions = prior && Array.isArray(prior.positions) ? prior.positions : [];
        const position = positions.map(bodyRecord).find((v) => v.instrumentId === o.instrumentId);
        overrides.push({
          instrumentId: String(o.instrumentId),
          prior: position?.mark ?? null,
          next: o,
          reason: String(o.reason),
        });
      }
    }
    this.record(
      {
        operation,
        principal: p,
        requestId: context.requestId,
        decision: "committed",
        reason:
          context.reviewReason ??
          (typeof request.reason === "string" ? request.reason : "Authorized command committed."),
        resourceId:
          typeof data.id === "string"
            ? data.id
            : typeof request.portfolioId === "string"
              ? request.portfolioId
              : null,
        revision: typeof data.revision === "number" ? data.revision : null,
        overrides,
      },
      true,
    );
  };
  record(
    value: {
      operation: string;
      principal: Principal | undefined;
      requestId: string;
      decision: "committed" | "denied";
      reason: string;
      resourceId?: string | null;
      revision?: number | null;
      overrides?: unknown[];
    },
    inTransaction = false,
  ) {
    const event = governanceAuditSchema.parse({
      id: randomUUID(),
      at: this.clock.now(),
      actorId: value.principal?.actor.id ?? null,
      scopeId: this.scopeId,
      policyRevision: this.policyRevision,
      requestId: value.requestId,
      operation: value.operation,
      decision: value.decision,
      reason: value.reason,
      resourceId: value.resourceId ?? null,
      revision: value.revision ?? null,
      overrides: value.overrides ?? [],
    });
    const save = () => this.db.append("governance-audit", event.id, 1, event);
    if (inTransaction) save();
    else this.db.run(save);
  }
}
