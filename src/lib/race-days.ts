/**
 * Race-day scheduling helpers.
 *
 * NEXT_PUBLIC_RACE_DAYS = comma-separated JS day-of-week numbers (0=Sun … 6=Sat).
 * Default: "5,0" = Friday + Sunday.
 *
 * NEXT_PUBLIC_BETTING_OPENS_HOUR = hour (UTC) when betting opens (default: 7 = 7AM).
 * NEXT_PUBLIC_BETTING_CUTOFF_HOUR = hour (UTC) when betting closes (default: 23 = 11PM).
 */

const raw = process.env.NEXT_PUBLIC_RACE_DAYS || "5,0";
const RACE_DAYS: Set<number> = new Set(
  raw.split(",").map((s) => Number(s.trim())).filter((n) => n >= 0 && n <= 6)
);

export const BETTING_OPENS_HOUR = Number(
  process.env.NEXT_PUBLIC_BETTING_OPENS_HOUR || "7"
);
export const BETTING_CUTOFF_HOUR = Number(
  process.env.NEXT_PUBLIC_BETTING_CUTOFF_HOUR || "23"
);

/** French day names indexed by JS getUTCDay() (0 = dimanche). */
export const RACE_DAY_NAMES: Record<number, string> = {
  0: "dimanche",
  1: "lundi",
  2: "mardi",
  3: "mercredi",
  4: "jeudi",
  5: "vendredi",
  6: "samedi",
};

/** True if `date` (UTC) falls on a configured race day. */
export function isRaceDay(date: Date): boolean {
  return RACE_DAYS.has(date.getUTCDay());
}

/**
 * Return the next upcoming race day (midnight UTC) strictly after `date`.
 * Advances day-by-day (max 7 iterations).
 */
export function getNextRaceDay(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  for (let i = 1; i <= 7; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (RACE_DAYS.has(d.getUTCDay())) return d;
  }
  // Fallback (should never happen with ≥1 race day configured)
  return d;
}

/**
 * Return the next race day at BETTING_CUTOFF_HOUR UTC whose cutoff is still
 * in the future. Used by importCourse to set the betting deadline.
 */
export function getNextRaceDayCutoff(now: Date): Date {
  // Check today first: if it's a race day and cutoff hasn't passed, use today.
  const todayCutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), BETTING_CUTOFF_HOUR, 0, 0)
  );
  if (RACE_DAYS.has(now.getUTCDay()) && todayCutoff.getTime() > now.getTime()) {
    return todayCutoff;
  }
  // Otherwise advance to the next race day.
  const next = getNextRaceDay(now);
  return new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), BETTING_CUTOFF_HOUR, 0, 0)
  );
}

/**
 * Compute the betting-opens timestamp for a given course date.
 */
export function getBettingOpensAt(courseDate: Date): Date {
  return new Date(
    Date.UTC(
      courseDate.getUTCFullYear(),
      courseDate.getUTCMonth(),
      courseDate.getUTCDate(),
      BETTING_OPENS_HOUR,
      0,
      0
    )
  );
}
