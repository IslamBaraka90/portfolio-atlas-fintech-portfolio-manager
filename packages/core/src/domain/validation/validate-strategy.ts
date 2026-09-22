import {
  historicalFixtureSchema,
  type HistoricalFixture,
  type ValidationRequest,
  type ValidationRun,
} from "@portfolio-atlas/contracts";
import type { DrawdownEngine } from "../../ports/validation.js";
import { replayFold, type FoldPlan } from "./replay-fold.js";
export function validateStrategy(
  input: HistoricalFixture,
  request: ValidationRequest,
  engine: DrawdownEngine,
) {
  const fixture = historicalFixtureSchema.parse(input),
    reasons: string[] = [];
  if (request.dataset)
    reasons.push(
      "Current observed-now market history has no historical availability or survivor-safe universe evidence.",
    );
  if (
    fixture.bars.length !== 16 ||
    fixture.expectedSessions.length !== 16 ||
    fixture.bars.some((b, i) => b.session !== fixture.expectedSessions[i])
  )
    reasons.push("An expected session is missing or out of order; never compress the timeline.");
  if (
    fixture.bars.some(
      (b, i) =>
        b.openAt >= b.closeAt ||
        b.availableAt !== b.closeAt ||
        (i > 0 && b.openAt <= fixture.bars[i - 1]!.availableAt),
    )
  )
    reasons.push("This daily model requires ordered sessions with closes available at close.");
  const ids = fixture.instruments.map((i) => i.instrumentId);
  if (
    new Set(ids).size !== 2 ||
    ids.some(
      (id) =>
        fixture.membership.filter((m) => m.instrumentId === id).length !== 1 ||
        fixture.filings.filter((f) => f.instrumentId === id).length !== 1,
    )
  )
    reasons.push("Historical identity, membership and filing coverage must be complete.");
  if (
    fixture.instruments.some(
      (i) =>
        i.source !== "synthetic" ||
        i.quoteUnit.currency !== "USD" ||
        i.quoteUnit.scaleToCurrency !== 1 ||
        i.lotSize !== 1,
    )
  )
    reasons.push("Only authored USD whole-share instruments are supported.");
  const plans: FoldPlan[] = [];
  if (!reasons.length)
    for (const [n, start] of [4, 8, 12].entries()) {
      const end = start - 1,
        from = request.window === "expanding" ? 0 : start - 4,
        decision = fixture.bars[end]!.availableAt;
      if (
        fixture.instruments.some((i) => i.observedAt > fixture.bars[from]!.openAt) ||
        fixture.membership.some(
          (m) =>
            m.availableAt > decision ||
            m.from > decision ||
            (m.to !== null &&
              (m.recoveryPrice === null || !fixture.bars.some((b) => b.openAt === m.to))),
        ) ||
        fixture.filings.some((f) => f.availableAt > decision)
      ) {
        reasons.push(
          "Information cutoff failed for " +
            (n === 2 ? "holdout" : "fold-" + (n + 1)) +
            ": identity, membership, recovery or filing was unavailable.",
        );
        continue;
      }
      // Fit only on this slice. Neither test prices nor the holdout are passed to scoring.
      const training = fixture.bars.slice(from, end + 1);
      const scores = ids
        .filter((id) => {
          const m = fixture.membership.find((m) => m.instrumentId === id)!;
          return m.to === null || m.to > decision;
        })
        .map((instrumentId) => {
          const i = ids.indexOf(instrumentId);
          return { instrumentId, score: training.at(-1)!.closes[i]! / training[0]!.closes[i]! - 1 };
        })
        .sort((a, b) => b.score - a.score || a.instrumentId.localeCompare(b.instrumentId));
      plans.push({
        name: n === 2 ? "holdout" : "fold-" + (n + 1),
        holdout: n === 2,
        trainStart: from,
        trainEnd: end,
        testStart: start,
        testEnd: start + 3,
        decisionAt: decision,
        scores,
        selectedIds: scores[0] && scores[0].score > 0 ? [scores[0].instrumentId] : [],
      });
    }
  const folds: ValidationRun["folds"] = [];
  if (!reasons.length)
    for (const plan of plans)
      for (const fee of [...new Set([0, request.feeBps, request.feeBps * 2])])
        for (const policy of ["momentum", "equal_baseline"] as const)
          folds.push(replayFold(fixture, plan, policy, fee, engine));
  return {
    fixture,
    request,
    status: reasons.length ? ("blocked" as const) : ("synthetic_experiment" as const),
    reasons,
    folds,
    warnings: [
      "Authored synthetic evidence, not live performance or proof of profitability.",
      "Each fold is separately funded; do not compound the fold results as one traded account.",
      "Final holdout is not used in fitting. Repeated user experiments can still overfit.",
      "Next-open budget sizing; whole shares, no spread/impact, dividends, splits or terminal liquidation.",
      "Seed 0 is recorded for reproducibility; this policy has no random component.",
      "Drawdown: fintech-algorithms 0.13.2 D00-F11-A03 shared-fixture verified; accounting examples independently checked.",
    ],
    policyVersion: "chapter-10.v1" as const,
    packageVersion: "0.13.2" as const,
  };
}
