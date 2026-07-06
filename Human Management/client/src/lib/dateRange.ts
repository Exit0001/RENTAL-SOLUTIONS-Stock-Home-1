import type { DayAssignment } from "@app/shared/validation/jobs.schema";

export function listDatesInclusive(start: string, end: string): string[] {
  if (!start || !end || end < start) return [];
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function syncDayAssignments(current: DayAssignment[], start: string, end: string): DayAssignment[] {
  const dates = listDatesInclusive(start, end);
  const byDate = new Map(current.map((d) => [d.date, d]));
  return dates.map(
    (date) => byDate.get(date) ?? { date, staffIds: [], vehicleIds: [], outsourceCrewCount: 0, outsourceTruckCount: 0 },
  );
}
