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

// The UTC instant of a local wall-clock time on a local date in an exchange timezone.
// Two correction passes converge across DST changes because offsets move by at most
// one hour and never twice in one day at the regular-session times used here.
export function localInstant(timezone: string, localDate: string, minutes: number) {
  const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
  let guess = Date.UTC(y, m - 1, d, 0, minutes);
  for (let pass = 0; pass < 2; pass++) {
    const local = localParts(timezone, new Date(guess));
    const dayShift = Math.round(
      (Date.parse(local.date + "T00:00:00Z") - Date.parse(localDate + "T00:00:00Z")) / 86_400_000,
    );
    guess -= (dayShift * 1440 + local.minutes - minutes) * 60_000;
  }
  return new Date(guess).toISOString();
}

export function sessionClose(timezone: string, localDate: string) {
  const venue = venues[timezone];
  return venue ? localInstant(timezone, localDate, venue.close) : null;
}

// A bar is final once its interval has ended and a grace period has passed; a daily
// bar ends at the session close. Intraday bars never extend past the close, so the
// last hourly bar of a 09:30–16:00 session ends at 16:00, not 16:30.
export function barFinality(input: {
  timestamp: string;
  durationMs: number | null;
  timezone: string | null;
  now: string;
  graceMs: number;
}): {
  finality: "final" | "incomplete";
  sessionDate: string | null;
  end: string;
  finalAt: string;
  evidence: string;
} {
  const start = Date.parse(input.timestamp);
  const venue = input.timezone ? venues[input.timezone] : undefined;
  const sessionDate = input.timezone ? localParts(input.timezone, new Date(start)).date : null;
  const close =
    venue && sessionDate
      ? Date.parse(localInstant(input.timezone!, sessionDate, venue.close))
      : null;
  let end: number;
  let evidence: string;
  if (input.durationMs === null) {
    end = close ?? start + 86_400_000;
    evidence = close
      ? "Daily bar ends at the " + venue!.label.split("–")[1] + " session close."
      : "Unmodeled venue: the daily bar is assumed to end 24 h after its start.";
  } else {
    end = start + input.durationMs;
    evidence = "Intraday bar ends after its " + input.durationMs / 60_000 + "-minute interval.";
    if (close !== null && end > close && start < close) {
      end = close;
      evidence = "Intraday bar is cut at the session close.";
    }
  }
  const finalAt = end + input.graceMs;
  const final = Date.parse(input.now) >= finalAt;
  return {
    finality: final ? "final" : "incomplete",
    sessionDate,
    end: new Date(end).toISOString(),
    finalAt: new Date(finalAt).toISOString(),
    evidence: evidence + (final ? " Final after grace." : " Still forming until the grace passes."),
  };
}
