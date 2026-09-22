import type {
  AuditEvent,
  CandidateAllocation,
  Evaluation,
  Mandate,
  MandateInput,
  Portfolio,
  PortfolioInput,
} from "@portfolio-atlas/contracts";
import { evaluateMandate } from "../domain/evaluate-mandate.js";
import type { Clock, IdFactory, PortfolioRepository } from "../ports/portfolio-repository.js";

import { ApplicationError } from "./errors.js";
import { Commands, type CommandContext } from "./commands.js";
export { ApplicationError } from "./errors.js";
export type { CommandContext } from "./commands.js";

export class PortfolioService {
  constructor(
    private readonly repository: PortfolioRepository,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands = new Commands(repository),
  ) {}

  listMandates() {
    return this.repository.mandates();
  }
  getMandate(id: string): Mandate {
    const mandate = this.repository.mandate(id);
    if (!mandate) throw new ApplicationError("NOT_FOUND", "Mandate not found in this session.");
    return mandate;
  }
  revisions(id: string) {
    this.getMandate(id);
    return this.repository.revisions(id);
  }
  listPortfolios() {
    return this.repository.portfolios();
  }
  getPortfolio(id: string): Portfolio {
    const portfolio = this.repository.portfolio(id);
    if (!portfolio) throw new ApplicationError("NOT_FOUND", "Portfolio not found in this session.");
    return portfolio;
  }
  getEvaluation(id: string): Evaluation {
    const evaluation = this.repository.evaluation(id);
    if (!evaluation)
      throw new ApplicationError("NOT_FOUND", "Evaluation not found in this session.");
    return evaluation;
  }
  audit() {
    return this.repository.audit();
  }

  createMandate(input: MandateInput, context: CommandContext): Mandate {
    return this.once("mandate.create", input, context, () => {
      const now = this.clock.now();
      const mandate = {
        ...input,
        id: this.ids.next(),
        revision: 1,
        createdAt: now,
        updatedAt: now,
      };
      this.repository.saveMandate(mandate);
      this.record("mandate.created", mandate.id, mandate.revision, now, context);
      return mandate;
    });
  }
  updateMandate(
    id: string,
    expectedRevision: number,
    input: MandateInput,
    context: CommandContext,
  ): Mandate {
    return this.once("mandate.update", { id, expectedRevision, input }, context, () => {
      const current = this.currentRevision(id, expectedRevision);
      if (
        current.baseCurrency !== input.baseCurrency &&
        this.repository.portfolios().some((p) => p.mandateId === id)
      ) {
        throw new ApplicationError(
          "CURRENCY_IN_USE",
          "A portfolio already uses this currency. Create a new mandate to change its base currency.",
        );
      }
      const mandate = {
        ...current,
        ...input,
        revision: current.revision + 1,
        updatedAt: this.clock.now(),
      };
      this.repository.saveMandate(mandate);
      this.record("mandate.updated", mandate.id, mandate.revision, mandate.updatedAt, context);
      return mandate;
    });
  }
  createPortfolio(input: PortfolioInput, context: CommandContext): Portfolio {
    return this.once("portfolio.create", input, context, () => {
      const mandate = this.getMandate(input.mandateId);
      const portfolio = {
        ...input,
        id: this.ids.next(),
        baseCurrency: mandate.baseCurrency,
        createdAt: this.clock.now(),
      };
      this.repository.savePortfolio(portfolio);
      this.record("portfolio.created", portfolio.id, null, portfolio.createdAt, context);
      return portfolio;
    });
  }
  evaluate(
    id: string,
    expectedRevision: number,
    allocation: CandidateAllocation,
    context: CommandContext,
  ): Evaluation {
    return this.once("allocation.evaluate", { id, expectedRevision, allocation }, context, () => {
      const mandate = this.currentRevision(id, expectedRevision);
      const evaluatedAt = this.clock.now();
      let result = evaluateMandate(mandate, allocation);
      const asOf = Date.parse(allocation.asOf);
      if (
        result.status !== "invalid" &&
        (asOf < Date.parse(mandate.updatedAt) || asOf > Date.parse(evaluatedAt))
      ) {
        result = {
          status: "not_evaluable",
          findings: [
            {
              code: "POLICY_TIME",
              rule: "Policy effective time",
              subject: "Allocation",
              status: "not_evaluable",
              observed: null,
              limit: null,
              comparison: "known",
              unit: "policy",
              explanation:
                "Allocation time must be on or after this mandate revision and no later than evaluation time. This chapter cannot reconstruct historical policy.",
            },
          ],
        };
      }
      const evaluation: Evaluation = {
        id: this.ids.next(),
        mandateId: id,
        mandateRevision: mandate.revision,
        policyVersion: "chapter-1.v1",
        evaluatedAt,
        allocation,
        result,
      };
      this.repository.saveEvaluation(evaluation);
      this.record("allocation.evaluated", evaluation.id, mandate.revision, evaluatedAt, context);
      return evaluation;
    });
  }

  private currentRevision(id: string, expectedRevision: number) {
    const mandate = this.getMandate(id);
    if (mandate.revision !== expectedRevision)
      throw new ApplicationError(
        "REVISION_CONFLICT",
        "The mandate changed. Reload it before submitting this command.",
      );
    return mandate;
  }
  private record(
    action: AuditEvent["action"],
    resourceId: string,
    revision: number | null,
    recordedAt: string,
    context: CommandContext,
  ) {
    this.repository.appendAudit({
      id: this.ids.next(),
      action,
      resourceId,
      revision,
      recordedAt,
      actor: "local-learner",
      requestId: context.requestId,
    });
  }
  private once<T>(operation: string, input: unknown, context: CommandContext, execute: () => T): T {
    return this.commands.executeSync(operation, input, context, execute);
  }
}
