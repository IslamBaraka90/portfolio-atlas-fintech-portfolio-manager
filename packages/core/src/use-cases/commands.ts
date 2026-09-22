import { ApplicationError } from "./errors.js";
import type { PortfolioRepository } from "../ports/portfolio-repository.js";
import { directTransactions, type Transactions } from "../ports/transactions.js";
export interface CommandContext {
  key: string;
  requestId: string;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ":" + canonical(item))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
// Network preparation may overlap. The returned commit function is synchronous:
// its state changes and replay record share one short database transaction.
export class Commands {
  private readonly pending = new Map<string, { fingerprint: string; result: Promise<unknown> }>();
  constructor(
    private readonly store: Pick<PortfolioRepository, "command" | "saveCommand">,
    private readonly transactions: Transactions = directTransactions,
  ) {}
  private replay<T>(record: { fingerprint: string; result: unknown }, fingerprint: string): T {
    if (record.fingerprint !== fingerprint)
      throw new ApplicationError(
        "IDEMPOTENCY_CONFLICT",
        "This command key was already used with different input.",
      );
    return structuredClone(record.result) as T;
  }
  private commit<T>(
    fingerprint: string,
    context: CommandContext,
    action: () => T,
    persist: (value: T) => boolean,
  ): T {
    return this.transactions.run(() => {
      const saved = this.store.command(context.key);
      if (saved) return this.replay<T>(saved, fingerprint);
      const value = action();
      if (value instanceof Promise) throw new Error("Commit callbacks must be synchronous.");
      if (persist(value)) this.store.saveCommand(context.key, fingerprint, value);
      return structuredClone(value);
    });
  }
  executeSync<T>(operation: string, input: unknown, context: CommandContext, action: () => T): T {
    if (this.pending.has(context.key))
      throw new ApplicationError(
        "IDEMPOTENCY_CONFLICT",
        "This key belongs to an in-flight command.",
      );
    return this.commit(canonical({ operation, input }), context, action, () => true);
  }
  async executePrepared<T>(
    operation: string,
    input: unknown,
    context: CommandContext,
    prepare: () => Promise<() => T>,
    persist: (value: T) => boolean = () => true,
  ): Promise<T> {
    const fingerprint = canonical({ operation, input }),
      saved = this.store.command(context.key),
      running = this.pending.get(context.key);
    if (saved) return this.replay<T>(saved, fingerprint);
    if (running) {
      if (running.fingerprint !== fingerprint)
        throw new ApplicationError(
          "IDEMPOTENCY_CONFLICT",
          "This key belongs to different in-flight input.",
        );
      return structuredClone(await running.result) as T;
    }
    const result = Promise.resolve()
      .then(prepare)
      .then((commit) => this.commit(fingerprint, context, commit, persist))
      .finally(() => this.pending.delete(context.key));
    this.pending.set(context.key, { fingerprint, result });
    return structuredClone(await result);
  }
  // For async computations with no persistent side effects. Mutating services use executePrepared.
  execute<T>(
    operation: string,
    input: unknown,
    context: CommandContext,
    action: () => Promise<T>,
    persist: (value: T) => boolean = () => true,
  ): Promise<T> {
    return this.executePrepared(
      operation,
      input,
      context,
      async () => {
        const value = await action();
        return () => value;
      },
      persist,
    );
  }
}
