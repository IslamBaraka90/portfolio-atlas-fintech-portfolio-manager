import {
  mandateSchema,
  portfolioSchema,
  evaluationSchema,
  auditEventSchema,
  instrumentSchema,
  marketDatasetSchema,
  actionReviewSchema,
  adjustmentResultSchema,
  type Mandate,
  type Portfolio,
  type Evaluation,
  type AuditEvent,
  type Instrument,
  type InstrumentCandidate,
  type MarketDataset,
  type ActionReview,
  type AdjustmentResult,
} from "@portfolio-atlas/contracts";
import type {
  PortfolioRepository,
  InstrumentRepository,
  DatasetRepository,
  ActionRepository,
} from "@portfolio-atlas/core";
import { SqliteDatabase } from "./database.js";
export class SqlitePortfolioRepository implements PortfolioRepository {
  constructor(private readonly db: SqliteDatabase) {}
  mandates() {
    return this.db.all("mandate").map((row) => mandateSchema.parse(row));
  }
  mandate(id: string) {
    const row = this.db.get("mandate", id);
    return row === undefined ? undefined : mandateSchema.parse(row);
  }
  revisions(id: string) {
    return this.db.revisions("mandate", id).map((row) => mandateSchema.parse(row));
  }
  saveMandate(value: Mandate) {
    this.db.append("mandate", value.id, value.revision, value);
  }
  portfolios() {
    return this.db.connection
      .prepare("SELECT payload FROM portfolios ORDER BY rowid")
      .all()
      .map((row) => portfolioSchema.parse(JSON.parse(String(row.payload))));
  }
  portfolio(id: string) {
    const row = this.db.connection.prepare("SELECT payload FROM portfolios WHERE id=?").get(id);
    return row ? portfolioSchema.parse(JSON.parse(String(row.payload))) : undefined;
  }
  savePortfolio(value: Portfolio) {
    this.db.connection
      .prepare("INSERT INTO portfolios(id,payload) VALUES(?,?)")
      .run(value.id, JSON.stringify(value));
  }
  evaluation(id: string) {
    const row = this.db.get("evaluation", id);
    return row === undefined ? undefined : evaluationSchema.parse(row);
  }
  saveEvaluation(value: Evaluation) {
    this.db.append("evaluation", value.id, 1, value);
  }
  audit() {
    return this.db.all("audit").map((row) => auditEventSchema.parse(row));
  }
  appendAudit(value: AuditEvent) {
    this.db.append("audit", value.id, 1, value);
  }
  command(key: string) {
    const row = this.db.connection
      .prepare("SELECT fingerprint,result FROM commands WHERE command_key=?")
      .get(key);
    return row
      ? { fingerprint: String(row.fingerprint), result: JSON.parse(String(row.result)) as unknown }
      : undefined;
  }
  saveCommand(key: string, fingerprint: string, result: unknown) {
    this.db.connection
      .prepare("INSERT INTO commands(command_key,fingerprint,result) VALUES(?,?,?)")
      .run(key, fingerprint, JSON.stringify(result));
  }
}
export class SqliteInstrumentRepository implements InstrumentRepository {
  // Search candidates are short-lived observations; saved identities are durable.
  private readonly candidates = new Map<string, InstrumentCandidate>();
  constructor(private readonly db: SqliteDatabase) {}
  candidate(id: string) {
    return structuredClone(this.candidates.get(id));
  }
  saveCandidate(value: InstrumentCandidate) {
    if (this.candidates.size >= 500) this.candidates.delete(this.candidates.keys().next().value!);
    this.candidates.set(value.candidateId, structuredClone(value));
  }
  all() {
    return this.db.all("instrument").map((row) => instrumentSchema.parse(row));
  }
  get(id: string) {
    const row = this.db.get("instrument", id);
    return row === undefined ? undefined : instrumentSchema.parse(row);
  }
  revisions(id: string) {
    return this.db.revisions("instrument", id).map((row) => instrumentSchema.parse(row));
  }
  save(value: Instrument) {
    this.db.append("instrument", value.instrumentId, value.revision, value);
  }
}
export class SqliteDatasetRepository implements DatasetRepository {
  constructor(private readonly db: SqliteDatabase) {}
  all() {
    return this.db.all("dataset").map((row) => marketDatasetSchema.parse(row));
  }
  get(id: string, revision?: number) {
    const row = this.db.get("dataset", id, revision);
    return row === undefined ? undefined : marketDatasetSchema.parse(row);
  }
  save(value: MarketDataset) {
    this.db.append("dataset", value.id, value.revision, value);
  }
}
export class SqliteActionRepository implements ActionRepository {
  constructor(private readonly db: SqliteDatabase) {}
  reviews() {
    return this.db.all("action-review").map((row) => actionReviewSchema.parse(row));
  }
  review(id: string) {
    const row = this.db.get("action-review", id);
    return row === undefined ? undefined : actionReviewSchema.parse(row);
  }
  saveReview(value: ActionReview) {
    this.db.append("action-review", value.id, 1, value);
  }
  runs() {
    return this.db.all("adjustment-run").map((row) => adjustmentResultSchema.parse(row));
  }
  run(id: string, revision?: number) {
    const row = this.db.get("adjustment-run", id, revision);
    return row === undefined ? undefined : adjustmentResultSchema.parse(row);
  }
  saveRun(value: AdjustmentResult) {
    this.db.append("adjustment-run", value.id, value.revision, value);
  }
}
