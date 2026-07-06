import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db/client";
import { jobs, jobStaffAssignments, jobVehicleAssignments } from "@app/shared/db/schema";
import type { ConflictsByDateInput, ConflictsByDateResult, DateAssignmentStatus } from "@app/shared/validation/assignments.schema";

export async function getConflictsByDate(input: ConflictsByDateInput): Promise<ConflictsByDateResult> {
  const dateFilter = and(
    inArray(jobStaffAssignments.date, input.dates),
    input.excludeJobId ? ne(jobs.id, input.excludeJobId) : undefined,
    ne(jobs.status, "cancelled"),
  );
  const vehicleDateFilter = and(
    inArray(jobVehicleAssignments.date, input.dates),
    input.excludeJobId ? ne(jobs.id, input.excludeJobId) : undefined,
    ne(jobs.status, "cancelled"),
  );

  const [staffRows, vehicleRows] = await Promise.all([
    db
      .select({
        date: jobStaffAssignments.date,
        staffId: jobStaffAssignments.staffId,
        jobId: jobs.id,
        jobName: jobs.name,
      })
      .from(jobStaffAssignments)
      .innerJoin(jobs, eq(jobs.id, jobStaffAssignments.jobId))
      .where(dateFilter),
    db
      .select({
        date: jobVehicleAssignments.date,
        vehicleId: jobVehicleAssignments.vehicleId,
        jobId: jobs.id,
        jobName: jobs.name,
      })
      .from(jobVehicleAssignments)
      .innerJoin(jobs, eq(jobs.id, jobVehicleAssignments.jobId))
      .where(vehicleDateFilter),
  ]);

  const result: ConflictsByDateResult = {};
  function statusFor(date: string): DateAssignmentStatus {
    let entry = result[date];
    if (!entry) {
      entry = { staffConflicts: {}, vehicleConflicts: {} };
      result[date] = entry;
    }
    return entry;
  }

  for (const row of staffRows) {
    const status = statusFor(row.date);
    if (!status.staffConflicts[row.staffId]) status.staffConflicts[row.staffId] = [];
    status.staffConflicts[row.staffId].push({ jobId: row.jobId, jobName: row.jobName });
  }
  for (const row of vehicleRows) {
    const status = statusFor(row.date);
    if (!status.vehicleConflicts[row.vehicleId]) status.vehicleConflicts[row.vehicleId] = [];
    status.vehicleConflicts[row.vehicleId].push({ jobId: row.jobId, jobName: row.jobName });
  }

  return result;
}
