import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { recoveryCheckpointSchema, recoveryResultSchema } from "@portfolio-atlas/contracts";
import { ApplicationError, type Clock, type Commands } from "@portfolio-atlas/core";
import type { SqliteDatabase, SqliteRecovery } from "@portfolio-atlas/adapters";
import type { HttpContext } from "./context.js";
export function registerRecoveryRoutes(
  app: FastifyInstance,
  db: SqliteDatabase,
  recovery: SqliteRecovery | null,
  commands: Commands,
  clock: Clock,
  http: HttpContext,
) {
  app.get("/api/v1/governance/recovery", async (r) =>
    http.response(
      {
        enabled: !!recovery,
        checkpoints: db.all("recovery-checkpoint").map((v) => recoveryCheckpointSchema.parse(v)),
        attempts: db.all("recovery-attempt").map((v) => recoveryResultSchema.parse(v)),
      },
      r,
    ),
  );
  const reasonSchema = z.strictObject({ reason: z.string().trim().min(10).max(500) });
  app.post("/api/v1/governance/backups", async (r, reply) => {
    const input = reasonSchema.parse(r.body),
      context = http.command(r);
    if (!recovery)
      throw new ApplicationError(
        "INVALID_SNAPSHOT",
        "Recovery requires the durable file-backed workspace.",
      );
    const result = await commands.executePrepared("recovery.backup", input, context, async () => {
      const snapshot = recovery.backup(clock.now(), r.principal!.actor.id);
      return () => {
        db.append("recovery-checkpoint", snapshot.id, 1, snapshot);
        return snapshot;
      };
    });
    return reply.code(201).send(http.response(result, r));
  });
  app.post("/api/v1/governance/backups/:id/restore", async (r, reply) => {
    const { id } = z.strictObject({ id: z.string().uuid() }).parse(r.params);
    const input = reasonSchema.parse(r.body),
      context = http.command(r);
    if (!recovery)
      throw new ApplicationError(
        "INVALID_SNAPSHOT",
        "Recovery requires the durable file-backed workspace.",
      );
    const stored = db.get("recovery-checkpoint", id);
    if (!stored) throw new ApplicationError("NOT_FOUND", "Backup checkpoint not found.");
    const result = await commands.executePrepared(
      "recovery.restore",
      { id, ...input },
      context,
      async () => {
        const attempt = recovery.restore(
          recoveryCheckpointSchema.parse(stored),
          clock.now(),
          r.principal!.actor.id,
        );
        return () => {
          db.append("recovery-attempt", attempt.id, 1, attempt);
          return attempt;
        };
      },
    );
    return reply.code(201).send(http.response(result, r));
  });
}
