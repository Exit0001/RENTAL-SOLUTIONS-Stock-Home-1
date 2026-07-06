import { and, count, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "../db/client";
import { jobs, staff, vehicles } from "@app/shared/db/schema";

function startOfWeekISO(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeekISO(date: Date) {
  const start = new Date(startOfWeekISO(date));
  start.setDate(start.getDate() + 6);
  return start.toISOString().slice(0, 10);
}

export async function getDashboardSummary() {
  const today = new Date();
  const weekStart = startOfWeekISO(today);
  const weekEnd = endOfWeekISO(today);

  const [jobsThisWeekRows, staffAvailableRows, staffTotalRows, vehiclesAvailableRows, vehiclesTotalRows] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(jobs)
        .where(and(lte(jobs.startDate, weekEnd), gte(jobs.endDate, weekStart), ne(jobs.status, "cancelled"))),
      db.select({ value: count() }).from(staff).where(eq(staff.status, "available")),
      db.select({ value: count() }).from(staff),
      db.select({ value: count() }).from(vehicles).where(eq(vehicles.status, "available")),
      db.select({ value: count() }).from(vehicles),
    ]);

  const upcomingJobsRows = await db
    .select({ value: count() })
    .from(jobs)
    .where(and(gte(jobs.endDate, today.toISOString().slice(0, 10)), ne(jobs.status, "cancelled")));

  const staffTotal = staffTotalRows[0]?.value ?? 0;
  const staffAvailable = staffAvailableRows[0]?.value ?? 0;
  const vehiclesTotal = vehiclesTotalRows[0]?.value ?? 0;
  const vehiclesAvailable = vehiclesAvailableRows[0]?.value ?? 0;

  return {
    jobsThisWeek: jobsThisWeekRows[0]?.value ?? 0,
    upcomingJobsCount: upcomingJobsRows[0]?.value ?? 0,
    staffAvailable,
    staffAssigned: staffTotal - staffAvailable,
    vehiclesAvailable,
    vehiclesAssigned: vehiclesTotal - vehiclesAvailable,
  };
}

export async function getUpcomingJobs(limit = 10) {
  const today = new Date().toISOString().slice(0, 10);
  return db
    .select()
    .from(jobs)
    .where(and(gte(jobs.endDate, today), ne(jobs.status, "cancelled")))
    .orderBy(jobs.startDate)
    .limit(limit);
}
