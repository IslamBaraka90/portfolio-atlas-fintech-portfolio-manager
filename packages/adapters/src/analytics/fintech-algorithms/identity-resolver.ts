import { resolveIdentifier } from "fintech-algorithms/corporate-actions-and-security-master-data/identity-continuity/permanent-security-identifier-mapping";
import {
  aliasResultSchema,
  type AliasQuery,
  type InstrumentAlias,
} from "@portfolio-atlas/contracts";
import type { IdentityResolver } from "@portfolio-atlas/core";

export class FintechIdentityResolver implements IdentityResolver {
  resolve(query: AliasQuery, aliases: InstrumentAlias[]) {
    const result = resolveIdentifier({
      query: {
        source: {
          scheme: "TICKER",
          value: query.symbol,
          entityLevel: "trading_line",
          venueMic: query.venueMic,
        },
        validAt: query.validAt,
        knowledgeAt: query.knowledgeAt,
      },
      assertions: aliases
        .filter((alias) => alias.venueMic !== null)
        .map((alias) => ({
          assertionId: alias.assertionId,
          revision: alias.revision,
          source: {
            scheme: "TICKER",
            value: alias.symbol,
            entityLevel: "trading_line",
            venueMic: alias.venueMic,
          },
          target: { canonicalId: alias.listingId, entityLevel: "trading_line" },
          validFrom: alias.validFrom,
          validTo: alias.validTo,
          observedAt: alias.observedAt,
          availableAt: alias.availableAt,
          status: "active",
          confidence: alias.provider === "synthetic" ? "authoritative" : "inferred",
          checkDigitStatus: "not_applicable",
          assignmentAuthority: alias.evidenceSource,
          sourceDocumentId: alias.assertionId,
        })),
    });
    // Installed declarations return Record<string, unknown>; validate the fields we consume.
    return aliasResultSchema.parse(result);
  }
}
