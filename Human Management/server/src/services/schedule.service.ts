import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db } from "../db/client";
import {
  jobs,
  staff,
  vehicles,
  jobStaffAssignments,
  jobVehicleAssignments,
} from "@app/shared/db/schema";
import type { ScheduleResource } from "@app/shared/types/api";

function isNextDay(date: string, candidate: string) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10) === candidate;
}

function toContiguousRuns(dates: string[]) {
  const sorted = [...new Set(dates)].sort();
  const runs: { startDate: string; endDate: string }[] = [];
  for (const date of sorted) {
    const last = runs[runs.length - 1];
    if (last && isNextDay(last.endDate, date)) {
      last.endDate = date;
    } else {
      runs.push({ startDate: date, endDate: date });
    }
  }
  return runs;
}

interface AssignmentRow {
  resourceId: string;
  date: string;
  jobId: string;
  jobName: string;
  status: "tentative" | "confirmed" | "completed" | "cancelled";
}

function buildJobSegments(rows: AssignmentRow[], resourceId: string) {
  const rowsForResource = rows.filter((row) => row.resourceId === resourceId);
  const byJob = new Map<string, { jobName: string; status: AssignmentRow["status"]; dates: string[] }>();
  for (const row of rowsForResource) {
    let entry = byJob.get(row.jobId);
    if (!entry) {
      entry = { jobName: row.jobName, status: row.status, dates: [] };
      byJob.set(row.jobId, entry);
    }
    entry.dates.push(row.date);
  }

  const segments: ScheduleResource["jobs"] = [];
  for (const [jobId, { jobName, status, dates }] of byJob) {
    for (const run of toContiguousRuns(dates)) {
      segments.push({ jobId, jobName, status, startDate: run.startDate, endDate: run.endDate });
    }
  }
  return segments;
}

export async function getSchedule(from: string, to: string): Promise<ScheduleResource[]> {
  const [allStaff, allVehicles, staffAssignmentRows, vehicleAssignmentRows] = await Promise.all([
    db.select().from(staff),
    db.select().from(vehicles),
    db
      .select({
        resourceId: jobStaffAssignments.staffId,
        date: jobStaffAssignments.date,
        jobId: jobs.id,
        jobName: jobs.name,
        status: jobs.status,
      })
      .from(jobStaffAssignments)
      .innerJoin(jobs, eq(jobs.id, jobStaffAssignments.jobId))
      .where(and(gte(jobStaffAssignments.date, from), lte(jobStaffAssignments.date, to), ne(jobs.status, "cancelled"))),
    db
      .select({
        resourceId: jobVehicleAssignments.vehicleId,
        date: jobVehicleAssignments.date,
        jobId: jobs.id,
        jobName: jobs.name,
        status: jobs.status,
      })
      .from(jobVehicleAssignments)
      .innerJoin(jobs, eq(jobs.id, jobVehicleAssignments.jobId))
      .where(and(gte(jobVehicleAssignments.date, from), lte(jobVehicleAssignments.date, to), ne(jobs.status, "cancelled"))),
  ]);

  const staffResources: ScheduleResource[] = allStaff.map((s) => ({
    id: s.id,
    name: s.name,
    type: "staff",
    jobs: buildJobSegments(staffAssignmentRows, s.id),
  }));

  const vehicleResources: ScheduleResource[] = allVehicles.map((v) => ({
    id: v.id,
    name: `${v.plateNumber} (${v.vehicleType})`,
    type: "vehicle",
    jobs: buildJobSegments(vehicleAssignmentRows, v.id),
  }));

  return [...staffResources, ...vehicleResources];
}
