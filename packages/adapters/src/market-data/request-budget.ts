import type { ProviderFailure } from "@portfolio-atlas/contracts";

export class ProviderError extends Error {
  constructor(public readonly failure: ProviderFailure) {
    super(failure.message);
  }
}

// There is deliberately no unbounded queue. A timed-out operation retains its slot
// until it actually settles, even if a test transport ignores cancellation.
export class RequestBudget {
  private active = 0;
  constructor(
    private readonly concurrency = 2,
    private readonly timeoutMs = 10_000,
  ) {
    if (
      !Number.isInteger(concurrency) ||
      concurrency < 1 ||
      concurrency > 8 ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 60_000
    )
      throw new RangeError("Invalid provider request budget.");
  }
  async run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency)
      throw new ProviderError({
        code: "BUDGET_EXCEEDED",
        message: "Provider request budget is full. Retry after current requests finish.",
        retryable: true,
      });
    this.active++;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new ProviderError({
            code: "TIMEOUT",
            message: "The provider did not answer within the configured deadline.",
            retryable: true,
          }),
        );
      }, this.timeoutMs);
    });
    const work = Promise.resolve()
      .then(() => operation(controller.signal))
      .finally(() => {
        this.active--;
        clearTimeout(timer);
      });
    return Promise.race([work, timeout]);
  }
}
