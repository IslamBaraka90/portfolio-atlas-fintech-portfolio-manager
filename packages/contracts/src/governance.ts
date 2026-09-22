import { z } from "zod";
export const roleSchema = z.enum(["reader", "analyst", "operator", "approver"]);
export type Role = z.infer<typeof roleSchema>;
export const actorSchema = z.strictObject({
  id: z.string().min(2).max(80),
  name: z.string().min(2).max(80),
  scopeId: z.string().min(2).max(80),
  roles: z.array(roleSchema).min(1),
});
export type Actor = z.infer<typeof actorSchema>;
export const accessConfigSchema = z
  .strictObject({
    scopeId: z.string().min(2).max(80),
    policyRevision: z.string().min(1).max(80),
    validFrom: z.iso.datetime(),
    validTo: z.iso.datetime(),
    actors: z
      .array(
        actorSchema.extend({
          tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
          validFrom: z.iso.datetime(),
          validTo: z.iso.datetime(),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((v, c) => {
    if (v.validFrom >= v.validTo || v.actors.some((a) => a.validFrom >= a.validTo))
      c.addIssue({ code: "custom", message: "Effective intervals must be increasing." });
    if (
      new Set(v.actors.map((a) => a.id)).size !== v.actors.length ||
      new Set(v.actors.map((a) => a.tokenHash)).size !== v.actors.length
    )
      c.addIssue({ code: "custom", message: "Actor IDs and token hashes must be unique." });
  });
export type AccessConfig = z.infer<typeof accessConfigSchema>;
export const sessionProfileSchema = z.strictObject({
  mode: z.enum(["local_owner", "configured_sessions"]),
  actor: actorSchema.nullable(),
  policyRevision: z.string(),
  csrf: z.string().nullable(),
  expiresAt: z.iso.datetime().nullable(),
});
export type SessionProfile = z.infer<typeof sessionProfileSchema>;
export const governanceAuditSchema = z.strictObject({
  id: z.string(),
  at: z.iso.datetime(),
  actorId: z.string().nullable(),
  scopeId: z.string(),
  policyRevision: z.string(),
  requestId: z.string(),
  operation: z.string(),
  decision: z.enum(["committed", "denied"]),
  reason: z.string(),
  resourceId: z.string().nullable(),
  revision: z.number().int().nullable(),
  overrides: z
    .array(
      z.strictObject({
        instrumentId: z.string(),
        prior: z.unknown(),
        next: z.unknown(),
        reason: z.string(),
      }),
    )
    .default([]),
});
export type GovernanceAudit = z.infer<typeof governanceAuditSchema>;
export const approvalItemSchema = z.strictObject({
  kind: z.enum(["rebalance", "resolution", "report"]),
  id: z.string(),
  revision: z.number().int(),
  creatorId: z.string().nullable(),
  canApprove: z.boolean(),
  reason: z.string(),
});
export const recoveryCheckpointSchema = z.strictObject({
  id: z.string(),
  createdAt: z.iso.datetime(),
  actorId: z.string(),
  manifestHash: z.string(),
  portfolioCount: z.number().int(),
  documentCount: z.number().int(),
  files: z.number().int(),
  status: z.literal("backed_up"),
});
export const recoveryResultSchema = z.strictObject({
  id: z.string(),
  backupId: z.string(),
  at: z.iso.datetime(),
  actorId: z.string(),
  status: z.enum(["verified", "failed"]),
  reason: z.string(),
  restoredDirectory: z.string().nullable(),
  portfolioCount: z.number().int(),
});
export const recoveryStatusSchema = z.strictObject({
  enabled: z.boolean(),
  checkpoints: z.array(recoveryCheckpointSchema),
  attempts: z.array(recoveryResultSchema),
});
