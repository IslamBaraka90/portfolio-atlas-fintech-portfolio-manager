import {
  refreshCycleSchema,
  type LiveDecision,
  type LiveEvent,
  type LiveRuntimePolicy,
  type LiveStatus,
  type ProviderHealth,
  type RefreshCycle,
  type RefreshTaskResult,
  type SessionState,
} from "@portfolio-atlas/contracts";
import { sessionState } from "../domain/live/session-calendar.js";
import type { RefreshTask, Timer } from "../ports/live.js";
import type { Clock, IdFactory } from "../ports/portfolio-repository.js";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Transactions } from "../ports/transactions.js";
import type { CommandContext, Commands } from "./commands.js";
import { ApplicationError } from "./errors.js";

const idleHealth: ProviderHealth = {
  status: "idle",
  consecutiveFailures: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailure: null,
  nextAttemptAt: null,
  backoffMs: 0,
};

// Runs refresh cycles on the configured cadence. Rules:
// - cycles never overlap; a tick that finds one running is skipped and logged;
// - intraday cadences run while the primary venue is open; every cadence runs one
//   cycle for each completed session that has none yet, capturing the final close
//   (including the previous session when the desk starts mid-session);
// - after a failed cycle the next attempt waits period × 2^(failures-1), capped;
// - a manual refresh runs immediately, except during another cycle.
export class LiveRefreshService {
  private readonly tasks: RefreshTask[] = [];
  private readonly listeners = new Set<(event: LiveEvent) => void>();
  private readonly decisions: LiveDecision[] = [];
  private health: ProviderHealth;
  private handle: unknown = null;
  private nextTickAt: string | null = null;
  private inProgress = false;
  private sequence: number;
  constructor(
    readonly policy: LiveRuntimePolicy,
    private readonly store: SnapshotRepository,
    private readonly transactions: Transactions,
    private readonly clock: Clock,
    private readonly ids: IdFactory,
    private readonly commands: Commands,
    private readonly timer: Timer,
  ) {
    const cycles = this.cycles();
    this.sequence = cycles[0]?.sequence ?? 0;
    this.health = cycles[0]?.health ?? idleHealth;
  }

  register(task: RefreshTask) {
    if (this.tasks.some((item) => item.name === task.name))
      throw new Error("Duplicate refresh task " + task.name);
    this.tasks.push(task);
  }
  subscribe(listener: (event: LiveEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  // Tasks publish their own committed results (quotes, NAV, alerts) on the stream.
  publish(event: LiveEvent) {
    this.emit(event);
  }
  private emit(event: LiveEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // A disconnected viewer must not interrupt the refresh loop.
      }
    }
  }

  cycles(limit = 50): RefreshCycle[] {
    return (this.store.all("live-cycle") as RefreshCycle[])
      .sort((a, b) => b.sequence - a.sequence)
      .slice(0, limit);
  }
  get(id: string) {
    const cycle = this.store.get("live-cycle", id) as RefreshCycle | undefined;
    if (!cycle) throw new ApplicationError("NOT_FOUND", "Refresh cycle not found.");
    return cycle;
  }
  session(at = this.clock.now()): SessionState {
    return sessionState(this.policy.primaryTimezone, at, this.policy.closeGraceMs);
  }
  status(): LiveStatus {
    return {
      policy: this.policy,
      session: this.session(),
      health: this.health,
      scheduler: this.handle === null ? "stopped" : "running",
      cycleInProgress: this.inProgress,
      decisions: [...this.decisions],
      nextTickAt: this.nextTickAt,
      lastCycle: this.cycles(1)[0] ?? null,
      tasks: this.tasks.map((task) => task.name),
    };
  }

  start() {
    if (this.handle !== null) return;
    this.schedule(0);
  }
  stop() {
    if (this.handle !== null) this.timer.clear(this.handle);
    this.handle = null;
    this.nextTickAt = null;
  }
  private schedule(ms: number) {
    this.nextTickAt = new Date(Date.parse(this.clock.now()) + ms).toISOString();
    this.handle = this.timer.set(() => {
      void this.tick().finally(() => {
        if (this.handle !== null) this.schedule(this.policy.periodMs);
      });
    }, ms);
  }
  private decide(action: LiveDecision["action"], reason: string) {
    this.decisions.unshift({ at: this.clock.now(), action, reason });
    this.decisions.length = Math.min(this.decisions.length, 20);
  }

  // Decides one scheduled tick. Exposed for deterministic tests.
  async tick(): Promise<RefreshCycle | null> {
    const now = this.clock.now();
    if (this.inProgress) {
      this.decide("skip", "The previous cycle is still running; cycles never overlap.");
      return null;
    }
    if (this.health.nextAttemptAt && Date.parse(now) < Date.parse(this.health.nextAttemptAt)) {
      this.decide(
        "skip",
        "Backing off after provider failures until " + this.health.nextAttemptAt + ".",
      );
      return null;
    }
    const session = this.session(now);
    if (session.state === "open" && this.policy.cadence !== "eod") {
      this.decide("run", "Primary venue open; intraday cadence " + this.policy.cadence + ".");
      return this.persisted(await this.execute("schedule", session, null));
    }
    const latest = session.latestCompletedSession;
    const captured =
      latest === null ||
      this.cycles().some(
        // A demo cycle never captures a session for the live desk, or the reverse.
        (cycle) =>
          cycle.coversSession === latest &&
          cycle.status !== "failed" &&
          cycle.mode === this.policy.mode,
      );
    if (!captured) {
      this.decide("run", "Capture completed session " + latest + ", which has no cycle yet.");
      return this.persisted(await this.execute("schedule", session, latest));
    }
    this.decide(
      "skip",
      session.state === "open"
        ? "End-of-day cadence waits for the session close."
        : "Market closed; session " + latest + " is already captured.",
    );
    return null;
  }

  async refreshNow(context: CommandContext) {
    const cycle = await this.commands.executePrepared("live.cycle", {}, context, async () => {
      const session = this.session();
      const result = await this.execute(
        "manual",
        session,
        session.state === "open" ? null : session.latestCompletedSession,
      );
      return () => this.append(result);
    });
    this.announce(cycle);
    return cycle;
  }

  // Viewers hear about a cycle only after its transaction commits.
  private persisted(cycle: RefreshCycle) {
    this.transactions.run(() => this.append(cycle));
    this.announce(cycle);
    return cycle;
  }
  private append(cycle: RefreshCycle) {
    this.store.append("live-cycle", cycle.id, 1, refreshCycleSchema.parse(cycle));
    return cycle;
  }
  private announce(cycle: RefreshCycle) {
    this.emit({ type: "cycle", data: cycle });
    this.emit({ type: "status", data: this.status() });
  }

  private async execute(
    trigger: RefreshCycle["trigger"],
    session: SessionState,
    coversSession: string | null,
  ): Promise<RefreshCycle> {
    if (this.inProgress)
      throw new ApplicationError("CYCLE_IN_PROGRESS", "A refresh cycle is already running.");
    this.inProgress = true;
    try {
      const scheduledAt = this.clock.now();
      const sequence = ++this.sequence;
      const id = this.ids.next();
      const results: RefreshTaskResult[] = [];
      for (const task of this.tasks) {
        try {
          const outcome = await task.run({
            cycleId: id,
            sequence,
            trigger,
            startedAt: scheduledAt,
            session,
            coversSession,
            policy: this.policy,
          });
          results.push({ name: task.name, ...outcome });
        } catch (error) {
          results.push({
            name: task.name,
            status: "failed",
            requested: 0,
            succeeded: 0,
            detail: error instanceof Error ? error.message : "Task failed.",
            failure: {
              code: "NETWORK",
              message: "The refresh task failed before reporting an outcome.",
              retryable: true,
            },
          });
        }
      }
      const completedAt = this.clock.now();
      const failed = results.filter((r) => r.status === "failed");
      const status =
        failed.length === 0
          ? "completed"
          : // Skipped tasks did no work, so they cannot make a failing cycle partial.
            failed.length === results.filter((r) => r.status !== "skipped").length
            ? "failed"
            : "partial";
      this.health = this.nextHealth(status, failed[0]?.failure ?? null, completedAt);
      return {
        id,
        sequence,
        policyVersion: this.policy.version,
        mode: this.policy.mode,
        cadence: this.policy.cadence,
        trigger,
        scheduledAt,
        startedAt: scheduledAt,
        completedAt,
        session,
        coversSession,
        status,
        tasks: results,
        health: this.health,
      };
    } finally {
      this.inProgress = false;
    }
  }

  private nextHealth(
    status: RefreshCycle["status"],
    failure: ProviderHealth["lastFailure"],
    at: string,
  ): ProviderHealth {
    if (status === "completed")
      return {
        ...idleHealth,
        status: "healthy",
        lastSuccessAt: at,
        lastFailureAt: this.health.lastFailureAt,
      };
    const failures = this.health.consecutiveFailures + 1;
    const backoffMs = Math.min(
      this.policy.periodMs * 2 ** (failures - 1),
      this.policy.backoffCeilingMs,
    );
    return {
      status: status === "partial" ? "degraded" : "backing_off",
      consecutiveFailures: failures,
      lastSuccessAt: status === "partial" ? at : this.health.lastSuccessAt,
      lastFailureAt: at,
      lastFailure: failure,
      nextAttemptAt: new Date(Date.parse(at) + backoffMs).toISOString(),
      backoffMs,
    };
  }
}
