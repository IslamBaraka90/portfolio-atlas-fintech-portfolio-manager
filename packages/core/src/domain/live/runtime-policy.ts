import {
  liveCadenceSchema,
  liveRuntimePolicySchema,
  marketDataModeSchema,
  providerSymbolSchema,
  type LiveCadence,
  type LiveRuntimePolicy,
} from "@portfolio-atlas/contracts";

export class LiveConfigError extends Error {
  constructor(
    readonly variable: string,
    message: string,
  ) {
    super(variable + ": " + message);
  }
}

// One table decides every cadence-dependent number. The cache always expires
// before the next scheduled cycle; freshness allows two periods of provider lag.
// End of day checks every 15 minutes but only runs once per completed session;
// its four-day freshness window spans a weekend plus one session.
const cadenceTable: Record<
  LiveCadence,
  { periodMs: number; cacheTtlMs: number; freshnessSeconds: number; backoffCeilingMs: number }
> = {
  eod: {
    periodMs: 900_000,
    cacheTtlMs: 600_000,
    freshnessSeconds: 4 * 86_400,
    backoffCeilingMs: 3_600_000,
  },
  "15m": {
    periodMs: 900_000,
    cacheTtlMs: 840_000,
    freshnessSeconds: 1_800,
    backoffCeilingMs: 3_600_000,
  },
  "5m": {
    periodMs: 300_000,
    cacheTtlMs: 270_000,
    freshnessSeconds: 600,
    backoffCeilingMs: 1_800_000,
  },
  "1m": { periodMs: 60_000, cacheTtlMs: 50_000, freshnessSeconds: 180, backoffCeilingMs: 900_000 },
};

export function cadencePolicy(cadence: LiveCadence) {
  return cadenceTable[cadence];
}

type Environment = Record<string, string | undefined>;

function parse<T>(variable: string, parser: (value: string) => T, value: string) {
  try {
    return parser(value);
  } catch {
    throw new LiveConfigError(variable, "unsupported value " + JSON.stringify(value) + ".");
  }
}

// Parses the environment once at startup. An invalid value stops the server with
// the variable's name instead of silently falling back to another cadence or mode.
export function parseLiveRuntime(env: Environment): LiveRuntimePolicy {
  const mode = parse(
    "MARKET_DATA_MODE",
    (v) => marketDataModeSchema.parse(v),
    (env.MARKET_DATA_MODE ?? "demo").trim(),
  );
  const cadence = parse(
    "LIVE_REFRESH",
    (v) => liveCadenceSchema.parse(v),
    (env.LIVE_REFRESH ?? "eod").trim(),
  );
  const watchlist = parse(
    "LIVE_WATCHLIST",
    (v) =>
      v
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean)
        .map((item) => providerSymbolSchema.parse(item)),
    env.LIVE_WATCHLIST ?? "SPY,AAPL,MSFT",
  );
  if (new Set(watchlist).size !== watchlist.length)
    throw new LiveConfigError("LIVE_WATCHLIST", "symbols must be unique.");
  if (watchlist.length > 50) throw new LiveConfigError("LIVE_WATCHLIST", "at most 50 symbols.");
  const benchmark = parse(
    "LIVE_BENCHMARK",
    (v) => providerSymbolSchema.parse(v.toUpperCase()),
    (env.LIVE_BENCHMARK ?? "SPY").trim(),
  );
  const requestsPerMinute = parse(
    "LIVE_MAX_REQUESTS_PER_MINUTE",
    (v) => {
      if (!/^\d+$/.test(v)) throw new Error();
      const n = Number(v);
      if (n < 1 || n > 120) throw new Error();
      return n;
    },
    (env.LIVE_MAX_REQUESTS_PER_MINUTE ?? "30").trim(),
  );
  return liveRuntimePolicySchema.parse({
    version: "chapter-18.live-runtime.v1",
    mode,
    cadence,
    ...cadenceTable[cadence],
    closeGraceMs: 15 * 60_000,
    primaryTimezone: "America/New_York",
    watchlist,
    benchmark,
    requestsPerMinute,
  });
}
