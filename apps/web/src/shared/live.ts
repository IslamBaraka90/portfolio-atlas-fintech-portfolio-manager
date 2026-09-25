import { useEffect, useSyncExternalStore } from "react";
import {
  liveSeriesSchema,
  liveStatusSchema,
  quoteBoardSchema,
  refreshCycleSchema,
  type LiveSeries,
  type LiveStatus,
  type QuoteBoard,
  type RefreshCycle,
} from "@portfolio-atlas/contracts";
import { read } from "./api";

// One shared live-status store fed by the server's event stream. The browser never
// talks to Yahoo; it hears the cycles the API completed.
type Connection = "connecting" | "open" | "reconnecting";
interface LiveSnapshot {
  status: LiveStatus | null;
  cycles: RefreshCycle[];
  board: QuoteBoard | null;
  // Latest revision seen per series id, so desks refetch only what changed.
  seriesRevisions: Record<string, number>;
  connection: Connection;
}
let status: LiveStatus | null = null;
let cycles: RefreshCycle[] = [];
let board: QuoteBoard | null = null;
let seriesRevisions: Record<string, number> = {};
let connection = "connecting" as Connection;
let source: EventSource | null = null;
let users = 0;
const listeners = new Set<() => void>();
let snapshot: LiveSnapshot = { status, cycles, board, seriesRevisions, connection };
function publish() {
  snapshot = { status, cycles, board, seriesRevisions, connection };
  listeners.forEach((listener) => listener());
}

function connect() {
  void read("/live/status", liveStatusSchema)
    .then((r) => {
      status = r.data;
      publish();
    })
    .catch(() => undefined);
  void read("/live/cycles", refreshCycleSchema.array())
    .then((r) => {
      cycles = r.data;
      publish();
    })
    .catch(() => undefined);
  void read("/live/quotes", quoteBoardSchema)
    .then((r) => {
      // A stream event may already have delivered a newer board.
      if (!board || r.data.revision > board.revision) board = r.data;
      publish();
    })
    .catch(() => undefined);
  if (typeof EventSource === "undefined") return;
  source = new EventSource("/api/v1/live/stream");
  source.onopen = () => {
    connection = "open";
    publish();
  };
  source.onerror = () => {
    // EventSource retries by itself; the desk says so instead of freezing silently.
    connection = "reconnecting";
    publish();
  };
  source.addEventListener("status", (event) => {
    const parsed = liveStatusSchema.safeParse(JSON.parse((event as MessageEvent).data));
    if (parsed.success) {
      status = parsed.data;
      publish();
    }
  });
  source.addEventListener("quotes", (event) => {
    const parsed = quoteBoardSchema.safeParse(JSON.parse((event as MessageEvent).data));
    if (parsed.success && (!board || parsed.data.revision >= board.revision)) {
      board = parsed.data;
      publish();
    }
  });
  source.addEventListener("series", (event) => {
    const parsed = liveSeriesSchema.safeParse(JSON.parse((event as MessageEvent).data));
    if (parsed.success) {
      seriesRevisions = { ...seriesRevisions, [parsed.data.id]: parsed.data.revision };
      publish();
    }
  });
  source.addEventListener("cycle", (event) => {
    const parsed = refreshCycleSchema.safeParse(JSON.parse((event as MessageEvent).data));
    if (parsed.success) {
      cycles = [parsed.data, ...cycles.filter((c) => c.id !== parsed.data.id)].slice(0, 50);
      publish();
    }
  });
}

export function useLive() {
  useEffect(() => {
    if (users++ === 0) connect();
    return () => {
      if (--users === 0) {
        source?.close();
        source = null;
        connection = "connecting";
      }
    };
  }, []);
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

export function recordCycle(cycle: RefreshCycle) {
  cycles = [cycle, ...cycles.filter((c) => c.id !== cycle.id)].slice(0, 50);
  publish();
}
