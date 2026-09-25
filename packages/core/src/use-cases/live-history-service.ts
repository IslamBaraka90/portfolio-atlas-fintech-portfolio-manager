import {
  liveBarSchema,
  liveSeriesSchema,
  type LiveBar,
  type LiveEvent,
  type LiveInterval,
  type LiveRuntimePolicy,
  type LiveSeries,
  type ProviderFailure,
} from "@portfolio-atlas/contracts";
import {
  IntervalLimitError,
  checkIntervalWindow,
  intervalForCadence,
  intervalLimits,
} from "../domain/live/interval-limits.js";
import { barFinality } from "../domain/live/session-calendar.js";
import type { BarProvider, LiveBarQuality } from "../ports/bars.js";
import type { RefreshContext, RefreshTask, RefreshTaskOutcome } from "../ports/live.js";
import type { RawArchive } from "../ports/market-data.js";
import type { Clock } from "../ports/portfolio-repository.js";
import type { SnapshotRepository } from "../ports/snapshot-repository.js";
import type { Transactions } from "../ports/transactions.js";

const day = 86_400_000;
const intradayGraceMs = 60_000;
const scaled = (v: number | null, scale: number | null) =>
  v === null || scale === null ? null : Number((v * scale).toFixed(10));

// Chapter 20: incremental live history. Each refresh requests only the tail of a
// series, overlapping the last known bars so forming bars can be revised:
// - a new bar start is appended (revision 1);
// - a forming bar that changed, or became final, gets its next revision;
// - a final bar never changes. If the provider later returns different values for
//   it, the stored bar stays and the disagreement is counted as evidence.
// A refresh with nothing new writes nothing.
export class LiveHistoryService {
  constructor(
    private readonly policy: LiveRuntimePolicy,
    private readonly provider: BarProvider,
    private readonly quality: LiveBarQuality,
    private readonly symbols: { tracked(): { symbol: string; instrumentId: string | null }[] },
    private readonly archive: RawArchive,
    private readonly store: SnapshotRepository,
    private readonly transactions: Transactions,
    private readonly clock: Clock,
    private readonly publish: (event: LiveEvent) => void,
  ) {}

  static seriesId(symbol: string, interval: LiveInterval) {
    return symbol + "|" + interval;
  }
  // The cadence's own interval plus daily bars, which later chapters use for risk.
  intervals(): LiveInterval[] {
    const intraday = intervalForCadence(this.policy.cadence);
    return intraday === "1d" ? ["1d"] : [intraday, "1d"];
  }
  series(): LiveSeries[] {
    return (this.store.all("live-series") as LiveSeries[]).sort((a, b) => a.id.localeCompare(b.id));
  }
  head(symbol: string, interval: LiveInterval) {
    return this.store.get("live-series", LiveHistoryService.seriesId(symbol, interval)) as
      LiveSeries | undefined;
  }
  bars(symbol: string, interval: LiveInterval, limit = 500): LiveBar[] {
    const prefix = LiveHistoryService.seriesId(symbol, interval) + "|";
    const rows = (
      this.store.prefixed
        ? this.store.prefixed("live-bar", prefix)
        : (this.store.all("live-bar") as LiveBar[]).filter((b) =>
            (b.seriesId + "|").startsWith(prefix),
          )
    ) as LiveBar[];
    return rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-limit);
  }

  task(): RefreshTask {
    return { name: "bars", run: (context) => this.refreshAll(context) };
  }

  // Intraday series refresh while the venue is open and once more after the close;
  // daily series refresh after each completed session, on manual refresh, or when new.
  async refreshAll(
    context: Pick<RefreshContext, "session" | "coversSession" | "trigger">,
  ): Promise<RefreshTaskOutcome> {
    const work: { symbol: string; instrumentId: string | null; interval: LiveInterval }[] = [];
    for (const tracked of this.symbols.tracked())
      for (const interval of this.intervals()) {
        const due =
          !this.head(tracked.symbol, interval) ||
          context.trigger === "manual" ||
          context.coversSession !== null ||
          (interval !== "1d" && context.session.state === "open");
        if (due) work.push({ ...tracked, interval });
      }
    if (!work.length)
      return {
        status: "skipped",
        requested: 0,
        succeeded: 0,
        detail: "No bar series due in this cycle.",
        failure: null,
      };
    const totals = { appended: 0, revised: 0, finalized: 0 };
    const failures: { symbol: string; failure: ProviderFailure }[] = [];
    let succeeded = 0;
    for (const item of work) {
      const result = await this.refresh(item.symbol, item.instrumentId, item.interval);
      if ("failure" in result) failures.push({ symbol: item.symbol, failure: result.failure });
      else {
        succeeded++;
        totals.appended += result.counts.appended;
        totals.revised += result.counts.revised;
        totals.finalized += result.counts.finalized;
      }
    }
    // One unknown symbol must not back off the whole desk: the task fails only when
    // every due series failed.
    const failed = succeeded === 0;
    return {
      status: failed ? "failed" : "succeeded",
      requested: work.length,
      succeeded,
      detail:
        succeeded +
        " of " +
        work.length +
        " series: " +
        totals.appended +
        " appended, " +
        totals.revised +
        " revised, " +
        totals.finalized +
        " finalized" +
        (failures.length
          ? "; unavailable: " +
            failures.map((f) => f.symbol + " (" + f.failure.code + ")").join(", ")
          : "") +
        ".",
      failure: failed ? failures[0]!.failure : null,
    };
  }

  async refresh(
    symbol: string,
    instrumentId: string | null,
    interval: LiveInterval,
  ): Promise<
    { series: LiveSeries; counts: LiveSeries["lastRefresh"] } | { failure: ProviderFailure }
  > {
    const id = LiveHistoryService.seriesId(symbol, interval);
    const limit = intervalLimits[interval];
    const head = this.head(symbol, interval);
    const now = this.clock.now();
    // Overlap two bars (two days for daily) so a forming bar is always re-requested.
    const overlap = (limit.durationMs ?? day) * 2;
    let from = head
      ? Date.parse(head.window.to) - overlap
      : Date.parse(now) - limit.backfillDays * day;
    if (limit.maxRequestDays !== null)
      from = Math.max(from, Date.parse(now) - limit.maxRequestDays * day + 60_000);
    const window = { from: new Date(from).toISOString(), to: now };
    try {
      checkIntervalWindow(interval, window.from, window.to, now);
    } catch (error) {
      if (error instanceof IntervalLimitError)
        return {
          failure: { code: "DISABLED", message: error.message, retryable: false },
        };
      throw error;
    }
    const reply = await this.provider.bars(symbol, interval, window);
    if (reply.status === "unavailable") return { failure: reply.failure };
    const { hash } = await this.archive.save(reply.data.raw);
    const scale = reply.data.quoteUnit.scaleToCurrency;
    const verdicts = this.quality.validate({
      symbol,
      instrumentId,
      rows: reply.data.rows,
      priceHint: reply.data.priceHint,
      scale,
      observedAt: reply.observedAt,
    });
    const existing = new Map(this.bars(symbol, interval, Infinity).map((b) => [b.timestamp, b]));
    const counts = { appended: 0, revised: 0, finalized: 0, unchanged: 0, providerRevisedFinal: 0 };
    const writes: LiveBar[] = [];
    reply.data.rows.forEach((row, index) => {
      const timestamp = new Date(row.timestamp).toISOString();
      const finality = barFinality({
        timestamp,
        durationMs: limit.durationMs,
        timezone: reply.data.timezone,
        now: reply.observedAt,
        graceMs: limit.durationMs === null ? this.policy.closeGraceMs : intradayGraceMs,
      });
      const verdict = verdicts[index]!;
      const values = {
        open: scaled(row.open, scale),
        high: scaled(row.high, scale),
        low: scaled(row.low, scale),
        close: scaled(row.close, scale),
        volume: row.volume,
      };
      const findings = [
        ...verdict.findings,
        ...(finality.finality === "incomplete"
          ? [{ code: "FORMING", reason: finality.evidence, severity: "warning" as const }]
          : []),
      ];
      const previous = existing.get(timestamp);
      const same =
        previous &&
        previous.open === values.open &&
        previous.high === values.high &&
        previous.low === values.low &&
        previous.close === values.close &&
        previous.volume === values.volume &&
        previous.accepted === verdict.accepted;
      if (previous?.finality === "final") {
        if (same) counts.unchanged++;
        else counts.providerRevisedFinal++;
        return;
      }
      if (previous && same && previous.finality === finality.finality) {
        counts.unchanged++;
        return;
      }
      const bar = liveBarSchema.parse({
        seriesId: id,
        revision: (previous?.revision ?? 0) + 1,
        timestamp,
        end: finality.end,
        sessionDate: finality.sessionDate,
        ...values,
        finality: finality.finality,
        finalAt: finality.finalAt,
        accepted: verdict.accepted,
        findings,
        firstObservedAt: previous?.firstObservedAt ?? reply.observedAt,
        observedAt: reply.observedAt,
        sourceHash: hash,
      });
      if (!previous) counts.appended++;
      else if (bar.finality === "final") counts.finalized++;
      else counts.revised++;
      writes.push(bar);
      existing.set(timestamp, bar);
    });
    const all = [...existing.values()];
    const changed = writes.length > 0 || !head || counts.providerRevisedFinal > 0;
    const series = liveSeriesSchema.parse({
      id,
      revision: (head?.revision ?? 0) + 1,
      symbol,
      instrumentId,
      source: reply.source,
      interval,
      timezone: reply.data.timezone,
      quoteUnit: reply.data.quoteUnit,
      policy: this.quality.policy,
      refreshedAt: reply.observedAt,
      window: {
        from: head && Date.parse(head.window.from) < from ? head.window.from : window.from,
        to: window.to,
      },
      sourceHash: hash,
      counts: {
        bars: all.length,
        final: all.filter((b) => b.finality === "final").length,
        forming: all.filter((b) => b.finality === "incomplete").length,
        quarantined: all.filter((b) => !b.accepted).length,
      },
      lastRefresh: counts,
      warnings: [
        "Live history is observed now; it is not point-in-time evidence.",
        ...(counts.providerRevisedFinal
          ? [
              counts.providerRevisedFinal +
                " final bar(s) differ from the provider's current values; stored bars were kept.",
            ]
          : []),
      ],
    });
    if (!changed) return { series: head!, counts };
    this.transactions.run(() => {
      for (const bar of writes)
        this.store.append("live-bar", id + "|" + bar.timestamp, bar.revision, bar);
      this.store.append("live-series", id, series.revision, series);
    });
    this.publish({ type: "series", data: series });
    return { series, counts };
  }
}
