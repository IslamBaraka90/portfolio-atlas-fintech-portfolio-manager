import type { AuditEvent, Evaluation, Mandate, Portfolio } from "@portfolio-atlas/contracts";

export interface Clock {
  now(): string;
}
export interface IdFactory {
  next(): string;
}

// This chapter is deliberately synchronous: one process completes a command before
// the next command starts. A durable implementation will need database transactions.
export interface PortfolioRepository {
  mandates(): Mandate[];
  mandate(id: string): Mandate | undefined;
  revisions(id: string): Mandate[];
  saveMandate(mandate: Mandate): void;
  portfolios(): Portfolio[];
  portfolio(id: string): Portfolio | undefined;
  savePortfolio(portfolio: Portfolio): void;
  evaluation(id: string): Evaluation | undefined;
  saveEvaluation(evaluation: Evaluation): void;
  audit(): AuditEvent[];
  appendAudit(event: AuditEvent): void;
  command(key: string): { fingerprint: string; result: unknown } | undefined;
  saveCommand(key: string, fingerprint: string, result: unknown): void;
}
