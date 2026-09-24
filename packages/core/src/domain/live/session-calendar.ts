import type { SessionState } from "@portfolio-atlas/contracts";

// Regular continuous-session hours by exchange timezone. Minutes after local midnight.
// Sources: NYSE and Nasdaq core trading 09:30–16:00 ET; LSE continuous trading
// 08:00–16:30 UK time. Auctions, holidays and half days are intentionally not modeled.
const venues: Record<string, { open: number; close: number; label: string }> = {
  "America/New_York": { open: 9 * 60 + 30, close: 16 * 60, label: "09:30–16:00" },
  "Europe/London": { open: 8 * 60, close: 16 * 60 + 30, label: "08:00–16:30" },
};

interface LocalParts {
  date: string;
  weekday: number; // 0 = Sunday
  minutes: number;
  time: string;
}

// Intl resolves the exchange's UTC offset for that instant, so DST changes on
// different dates in New York and London are handled without a hand-written table.
function localParts(timezone: string, instant: Date): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday!);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    minutes,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function previousDate(date: string) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return { date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
}

export function isSupportedVenueTimezone(timezone: string) {
  return timezone in venues;
}

// The most recent weekday session whose close plus grace has passed. With holidays
// unmodeled, a holiday may be named here; a refresh then records unchanged data.
export function latestCompletedSession(timezone: string, at: string, graceMs: number) {
  const venue = venues[timezone];
  if (!venue) return null;
  const local = localParts(timezone, new Date(Date.parse(at) - graceMs));
  let date = local.date,
    weekday = local.weekday;
  if (weekday >= 1 && weekday <= 5 && local.minutes >= venue.close) return date;
  do ({ date, weekday } = previousDate(date));
  while (weekday === 0 || weekday === 6);
  return date;
}

export function sessionState(timezone: string, at: string, graceMs = 0): SessionState {
  const venue = venues[timezone];
  if (!venue)
    return {
      timezone,
      venueHours: null,
      state: "unknown",
      basis: "unmodeled_timezone",
      localDate: null,
      localTime: null,
      latestCompletedSession: null,
      holidays: "not_modeled",
    };
  const local = localParts(timezone, new Date(at));
  const weekend = local.weekday === 0 || local.weekday === 6;
  const basis = weekend
    ? "weekend"
    : local.minutes < venue.open
      ? "before_open"
      : local.minutes >= venue.close
        ? "after_close"
        : "regular_hours";
  return {
    timezone,
    venueHours: venue.label,
    state: basis === "regular_hours" ? "open" : "closed",
    basis,
    localDate: local.date,
    localTime: local.time,
    latestCompletedSession: latestCompletedSession(timezone, at, graceMs),
    holidays: "not_modeled",
  };
}
