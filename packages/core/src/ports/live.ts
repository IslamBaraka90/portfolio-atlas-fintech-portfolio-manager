import type {
  LiveRuntimePolicy,
  ProviderFailure,
  RefreshCycle,
  SessionState,
} from "@portfolio-atlas/contracts";

// A timer port keeps the scheduler deterministic in tests; the server passes real timers.
export interface Timer {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}
export const systemTimer: Timer = {
  set: (callback, ms) => {
    const handle = setTimeout(callback, ms);
    // A pending refresh must never keep a finished process alive.
    handle.unref?.();
    return handle;
  },
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface RefreshContext {
  cycleId: string;
  sequence: number;
  trigger: RefreshCycle["trigger"];
  startedAt: string;
  session: SessionState;
  coversSession: string | null;
  policy: LiveRuntimePolicy;
}

export interface RefreshTaskOutcome {
  status: "succeeded" | "failed" | "skipped";
  requested: number;
  succeeded: number;
  detail: string;
  failure: ProviderFailure | null;
}

// Later chapters register tasks (quotes, bars, FX, valuation, risk). A task records
// its own evidence; the cycle records what each task reported.
export interface RefreshTask {
  readonly name: string;
  run(context: RefreshContext): Promise<RefreshTaskOutcome>;
}
