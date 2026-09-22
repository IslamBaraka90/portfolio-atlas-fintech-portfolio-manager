import { z } from "zod";
import type { DataMode } from "@portfolio-atlas/contracts";
import type { Clock, ProviderReply } from "@portfolio-atlas/core";
import { ProviderError, RequestBudget } from "./request-budget.js";
export class ProviderCalls {
  private readonly cache = new Map<string, { time: number; value: ProviderReply<unknown> }>();
  constructor(
    private readonly sourceMode: DataMode,
    protected readonly clock: Clock,
    private readonly budget: RequestBudget,
    private readonly ttlMs: number,
  ) {}
  protected async call<T>(
    key: string,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<ProviderReply<T>> {
    const now = Date.parse(this.clock.now());
    const cached = this.cache.get(key);
    if (cached && now >= cached.time && now - cached.time < this.ttlMs)
      return {
        ...(structuredClone(cached.value) as ProviderReply<T>),
        cache: "hit",
      } as ProviderReply<T>;
    try {
      const data = await this.budget.run(operation);
      const value: ProviderReply<T> = {
        status: "available",
        source: this.sourceMode,
        observedAt: this.clock.now(),
        cache: "fresh",
        data,
      };
      // A small bounded cache; eviction never changes the underlying evidence time.
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { time: Date.parse(value.observedAt), value: structuredClone(value) });
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const failure =
        error instanceof ProviderError
          ? error.failure
          : error instanceof z.ZodError ||
              (error instanceof Error && error.name === "FailedYahooValidationError")
            ? {
                code: "SCHEMA_MISMATCH" as const,
                message: "Provider evidence did not match the verified response contract.",
                retryable: false,
              }
            : /429|too many|rate limit/i.test(message)
              ? {
                  code: "THROTTLED" as const,
                  message: "The provider is throttling requests.",
                  retryable: true,
                }
              : {
                  code: "NETWORK" as const,
                  message: "The provider request failed. No synthetic data was substituted.",
                  retryable: true,
                };
      return {
        status: "unavailable",
        source: this.sourceMode,
        observedAt: this.clock.now(),
        cache: "none",
        failure,
      };
    }
  }
}
