import { randomBytes, createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { accessConfigSchema, type Role } from "@portfolio-atlas/contracts";

// Run once on the owner's machine. Secrets stay in ignored files, never console output.
const directory = resolve(".data/access");
mkdirSync(directory, { recursive: true });
const validFrom = new Date().toISOString();
const validTo = new Date(Date.now() + 90 * 86400000).toISOString();
const scopeId = randomUUID();
const credentials = (["reader", "analyst", "operator", "approver"] as Role[]).map((role) => ({
  id: role,
  name: role + " learner",
  roles: [role],
  scopeId,
  token: randomBytes(32).toString("base64url"),
}));
const config = accessConfigSchema.parse({
  scopeId,
  policyRevision: "chapter-17.v1",
  validFrom,
  validTo,
  actors: credentials.map(({ token, ...actor }) => ({
    ...actor,
    validFrom,
    validTo,
    tokenHash: createHash("sha256").update(token).digest("hex"),
  })),
});
writeFileSync(resolve(directory, "credentials.json"), JSON.stringify(credentials, null, 2) + "\n", {
  flag: "wx",
  mode: 0o600,
});
writeFileSync(resolve(directory, "policy.json"), JSON.stringify(config, null, 2) + "\n", {
  flag: "wx",
  mode: 0o600,
});
process.stdout.write(
  "Provisioned .data/access/policy.json and credentials.json. Protect these files with your OS account permissions. Set AUTH_CONFIG_PATH to the policy path, restart, and open Governance.\n",
);
