import type { CorporateAction } from "@portfolio-atlas/contracts";
export function selectActions(actions: CorporateAction[], knowledgeAt: string) {
  const cutoff = Date.parse(knowledgeAt);
  if (!Number.isFinite(cutoff)) throw new Error("Action cutoff must be a valid instant.");
  const grouped = new Map<string, CorporateAction[]>();
  const excluded: { id: string; revision: number; reason: string }[] = [];
  const selected: CorporateAction[] = [];
  for (const action of actions) grouped.set(action.id, [...(grouped.get(action.id) ?? []), action]);
  for (const revisions of grouped.values()) {
    revisions.sort((a, b) => a.revision - b.revision);
    if (new Set(revisions.map((row) => row.revision)).size !== revisions.length)
      throw new Error("Duplicate action revision.");
    for (let i = 1; i < revisions.length; i++)
      if (Date.parse(revisions[i]!.availableAt) < Date.parse(revisions[i - 1]!.availableAt))
        throw new Error("Action revision availability regressed.");
    const available = revisions.filter((row) => Date.parse(row.availableAt) <= cutoff);
    const latest = available.at(-1);
    for (const action of revisions) {
      if (action !== latest)
        excluded.push({
          id: action.id,
          revision: action.revision,
          reason:
            Date.parse(action.availableAt) > cutoff
              ? "Unavailable at action cutoff"
              : "Superseded by a later eligible revision",
        });
    }
    if (latest?.status === "cancelled")
      excluded.push({
        id: latest.id,
        revision: latest.revision,
        reason: "Cancelled at action cutoff",
      });
    else if (latest) selected.push(structuredClone(latest));
  }
  return { selected, excluded };
}
