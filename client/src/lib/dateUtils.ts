// Calendar-date helpers — LOCAL time, never UTC.
//
// Why this file exists: jobs/units store a calendar day as a timestamp at LOCAL
// midnight. In Thailand (UTC+7) "6 Aug" is persisted as `2026-08-05T17:00:00Z`.
// Anything that then reads the day back with `toISOString().slice(0, 10)` gets
// "2026-08-05" — one day early — while `toLocaleDateString()` correctly shows 6 Aug.
// That mismatch is exactly how a job entered as 6–8 Aug ended up being edited as
// 5–7 Aug and rendering the wrong days in the per-day schedule.
//
// Rule: for a calendar date (no time-of-day meaning), ALWAYS go through here.
// `toISOString()` is only correct for true instants, never for "which day is this".

const pad = (n: number) => String(n).padStart(2, "0");

/** Date -> "YYYY-MM-DD" using local calendar fields (safe for <input type="date">). */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Anything date-ish -> "YYYY-MM-DD", or "" when absent/invalid. */
export function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  return isNaN(dt.getTime()) ? "" : toDateStr(dt);
}

/**
 * "YYYY-MM-DD" -> Date at LOCAL midnight.
 * `new Date("2026-08-06")` would parse as UTC midnight and drift the day in
 * timezones behind UTC, so the parts are passed explicitly instead.
 */
export function fromDateInput(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Today as "YYYY-MM-DD" in local time (UTC would flip early for UTC+7 users). */
export function todayStr(): string {
  return toDateStr(new Date());
}
