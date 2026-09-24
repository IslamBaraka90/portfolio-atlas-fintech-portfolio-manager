import type { RefreshContext, RefreshTask, RefreshTaskOutcome } from "@portfolio-atlas/core";
import { toProviderFailure } from "../market-data/provider-calls.js";
import type { RequestBudget } from "../market-data/request-budget.js";

// Chapter 18's only refresh task: one benchmark quote proves the provider answers
// within the budget. Later chapters replace this signal with real work.
export class ProviderProbeTask implements RefreshTask {
  readonly name = "provider-probe";
  constructor(
    private readonly quote: ((symbol: string, signal: AbortSignal) => Promise<unknown>) | null,
    private readonly budget: RequestBudget,
  ) {}
  async run(context: RefreshContext): Promise<RefreshTaskOutcome> {
    if (context.policy.mode === "demo" || !this.quote)
      return {
        status: "succeeded",
        requested: 0,
        succeeded: 0,
        detail: "Demo mode serves synthetic fixtures; no provider request was made.",
        failure: null,
      };
    const quote = this.quote;
    try {
      await this.budget.run((signal) => quote(context.policy.benchmark, signal));
      return {
        status: "succeeded",
        requested: 1,
        succeeded: 1,
        detail: "Yahoo answered a quote request for " + context.policy.benchmark + ".",
        failure: null,
      };
    } catch (error) {
      const failure = toProviderFailure(error);
      return { status: "failed", requested: 1, succeeded: 0, detail: failure.message, failure };
    }
  }
}
