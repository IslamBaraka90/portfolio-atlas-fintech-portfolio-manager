import type { ProviderFailure } from "@portfolio-atlas/contracts";

export class ProviderError extends Error {
  constructor(public readonly failure: ProviderFailure) {
    super(failure.message);
  }
}

export interface RequestBudgetOptions {
  // Interactive lessons fail fast when full. Scheduled live refreshes queue instead.
  queue?: boolean;
  maxQueued?: number;
  // Minimum spacing between request starts, and a rolling one-minute start cap.
  minIntervalMs?: number;
  perMinute?: number | null;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
}

const realWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// A timed-out operation retains its slot until it actually settles, even if a test
// transport ignores cancellation. The queue is bounded so a stalled provider cannot
// accumulate unlimited scheduled work.
export class RequestBudget {
  private active = 0;
  private readonly waiting: (() => void)[] = [];
  private readonly starts: number[] = [];
  private lastStart = -Infinity;
  private gate: Promise<void> = Promise.resolve();
  private readonly queue: boolean;
  private readonly maxQueued: number;
  private readonly minIntervalMs: number;
  private readonly perMinute: number | null;
  private readonly now: () => number;
  private readonly wait: (ms: number) => Promise<void>;
  constructor(
    private readonly concurrency = 2,
    private readonly timeoutMs = 10_000,
    options: RequestBudgetOptions = {},
  ) {
    this.queue = options.queue ?? false;
    this.maxQueued = options.maxQueued ?? 200;
    this.minIntervalMs = options.minIntervalMs ?? 0;
    this.perMinute = options.perMinute ?? null;
    this.now = options.now ?? Date.now;
    this.wait = options.wait ?? realWait;
    if (
      !Number.isInteger(concurrency) ||
      concurrency < 1 ||
      concurrency > 8 ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs < 1 ||
      timeoutMs > 60_000 ||
      !Number.isInteger(this.maxQueued) ||
      this.maxQueued < 1 ||
      this.minIntervalMs < 0 ||
      (this.perMinute !== null && (!Number.isInteger(this.perMinute) || this.perMinute < 1))
    )
      throw new RangeError("Invalid provider request budget.");
  }
  get queued() {
    return this.waiting.length;
  }
  private full(): never {
    throw new ProviderError({
      code: "BUDGET_EXCEEDED",
      message: "Provider request budget is full. Retry after current requests finish.",
      retryable: true,
    });
  }
  private async slot() {
    if (this.active < this.concurrency && !this.waiting.length) {
      this.active++;
      return;
    }
    if (!this.queue || this.waiting.length >= this.maxQueued) this.full();
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }
  private release() {
    const next = this.waiting.shift();
    // The slot passes directly to the next waiter, so `active` is unchanged.
    if (next) next();
    else this.active--;
  }
  // Starts are serialized through one gate so spacing and the per-minute cap are
  // measured on actual start times, not on when callers arrived.
  private pace() {
    const turn = this.gate.then(async () => {
      for (;;) {
        const now = this.now();
        while (this.starts.length && now - this.starts[0]! >= 60_000) this.starts.shift();
        const spacing = this.lastStart + this.minIntervalMs - now;
        const cap =
          this.perMinute !== null && this.starts.length >= this.perMinute
            ? this.starts[0]! + 60_000 - now
            : 0;
        const delay = Math.max(spacing, cap, 0);
        if (delay === 0) break;
        await this.wait(delay);
      }
      this.lastStart = this.now();
      this.starts.push(this.lastStart);
    });
    this.gate = turn.catch(() => undefined);
    return turn;
  }
  async run<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    await this.slot();
    try {
      await this.pace();
    } catch (error) {
      this.release();
      throw error;
    }
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
        this.release();
        clearTimeout(timer);
      });
    return Promise.race([work, timeout]);
  }
}
