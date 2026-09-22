import type { AuditEvent, Evaluation, Mandate, Portfolio } from "@portfolio-atlas/contracts";
import type { PortfolioRepository } from "@portfolio-atlas/core";

// Each app instance owns one repository. Copies at both boundaries prevent callers
// from changing saved history by mutating an object they previously received.
export class MemoryPortfolioRepository implements PortfolioRepository {
  private readonly mandateHistory = new Map<string, Mandate[]>();
  private readonly portfolioRecords = new Map<string, Portfolio>();
  private readonly evaluations = new Map<string, Evaluation>();
  private readonly events: AuditEvent[] = [];
  private readonly commands = new Map<string, { fingerprint: string; result: unknown }>();

  mandates() {
    return structuredClone([...this.mandateHistory.values()].map((history) => history.at(-1)!));
  }
  mandate(id: string) {
    return structuredClone(this.mandateHistory.get(id)?.at(-1));
  }
  revisions(id: string) {
    return structuredClone(this.mandateHistory.get(id) ?? []);
  }
  saveMandate(mandate: Mandate) {
    const history = this.mandateHistory.get(mandate.id) ?? [];
    history.push(structuredClone(mandate));
    this.mandateHistory.set(mandate.id, history);
  }
  portfolios() {
    return structuredClone([...this.portfolioRecords.values()]);
  }
  portfolio(id: string) {
    return structuredClone(this.portfolioRecords.get(id));
  }
  savePortfolio(portfolio: Portfolio) {
    this.portfolioRecords.set(portfolio.id, structuredClone(portfolio));
  }
  evaluation(id: string) {
    return structuredClone(this.evaluations.get(id));
  }
  saveEvaluation(evaluation: Evaluation) {
    this.evaluations.set(evaluation.id, structuredClone(evaluation));
  }
  audit() {
    return structuredClone(this.events);
  }
  appendAudit(event: AuditEvent) {
    this.events.push(structuredClone(event));
  }
  command(key: string) {
    return structuredClone(this.commands.get(key));
  }
  saveCommand(key: string, fingerprint: string, result: unknown) {
    this.commands.set(key, structuredClone({ fingerprint, result }));
  }
}
