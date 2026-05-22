/**
 * Race-day scheduling helpers.
 *
 * NEXT_PUBLIC_RACE_DAYS = comma-separated JS day-of-week numbers (0=Sun … 6=Sat).
 * Default: "5,0" = Friday + Sunday.
 */

const raw = process.env.NEXT_PUBLIC_RACE_DAYS || "5,0";
const RACE_DAYS: Set<number> = new Set(
  raw.split(",").map((s) => Number(s.trim())).filter((n) => n >= 0 && n <= 6)
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
 * Return the next race day at 18:00 UTC whose cutoff is still in the future.
 * Used by the seed script to create the next available course.
 */
export function getNextRaceDayCutoff(now: Date): Date {
  // Check today first: if it's a race day and 18:00 hasn't passed, use today.
  const todayCutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18, 0, 0)
  );
  if (RACE_DAYS.has(now.getUTCDay()) && todayCutoff.getTime() > now.getTime()) {
    return todayCutoff;
  }
  // Otherwise advance to the next race day.
  const next = getNextRaceDay(now);
  return new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), 18, 0, 0)
  );
}
