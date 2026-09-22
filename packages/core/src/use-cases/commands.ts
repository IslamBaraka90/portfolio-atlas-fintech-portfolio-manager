import { ApplicationError } from "./errors.js";
export interface CommandContext {
  key: string;
  requestId: string;
}
import type { PortfolioRepository } from "../ports/portfolio-repository.js";

function canonical(value: unknown): string {
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
// Async provider operations may overlap. Identical in-flight commands share their
// promise; different inputs with the same key conflict before any second side effect.
export class Commands {
  private readonly pending = new Map<string, { fingerprint: string; result: Promise<unknown> }>();
  constructor(private readonly store: Pick<PortfolioRepository, "command" | "saveCommand">) {}
  executeSync<T>(operation: string, input: unknown, context: CommandContext, action: () => T): T {
    const fingerprint = canonical({ operation, input });
    if (this.pending.has(context.key))
      throw new ApplicationError(
        "IDEMPOTENCY_CONFLICT",
        "This key belongs to an in-flight command.",
      );
    const previous = this.store.command(context.key);
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new ApplicationError(
          "IDEMPOTENCY_CONFLICT",
          "This command key was already used with different input.",
        );
      return structuredClone(previous.result) as T;
    }
    const result = action();
    this.store.saveCommand(context.key, fingerprint, result);
    return structuredClone(result);
  }
  async execute<T>(
    operation: string,
    input: unknown,
    context: CommandContext,
    action: () => Promise<T>,
    persist: (result: T) => boolean = () => true,
  ): Promise<T> {
    const fingerprint = canonical({ operation, input });
    const saved = this.store.command(context.key);
    const running = this.pending.get(context.key);
    const previous = saved ?? running;
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new ApplicationError(
          "IDEMPOTENCY_CONFLICT",
          "This command key was already used with different input.",
        );
      return structuredClone(await previous.result) as T;
    }
    const result = Promise.resolve()
      .then(action)
      .then((value) => {
        if (persist(value)) this.store.saveCommand(context.key, fingerprint, value);
        return value;
      })
      .finally(() => this.pending.delete(context.key));
    this.pending.set(context.key, { fingerprint, result });
    return structuredClone(await result);
  }
}
