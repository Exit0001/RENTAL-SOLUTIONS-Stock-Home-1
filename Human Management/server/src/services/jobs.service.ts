import { and, eq, gte, inArray, like, lte, or } from "drizzle-orm";
import { db } from "../db/client";
import {
  jobs,
  staff,
  vehicles,
  jobStaffAssignments,
  jobVehicleAssignments,
  jobDayExtras,
  jobAttachments,
} from "@app/shared/db/schema";
import type { JobWithAssignmentsInput, JobUpdate, DayAssignment } from "@app/shared/validation/jobs.schema";
import type { JobDayAssignment, JobListDaySummary, JobListItem } from "@app/shared/types/api";
import { AppError } from "../lib/AppError";
import { getConflictsByDate } from "./conflicts.service";

interface ListJobsFilters {
  from?: string;
  to?: string;
  status?: string;
  search?: string;
}

export async function listJobs(filters: ListJobsFilters): Promise<JobListItem[]> {
  const conditions = [];
  if (filters.from) conditions.push(gte(jobs.endDate, filters.from));
  if (filters.to) conditions.push(lte(jobs.startDate, filters.to));
  if (filters.status) {
    conditions.push(eq(jobs.status, filters.status as "tentative" | "confirmed" | "completed" | "cancelled"));
  }
  if (filters.search) {
    conditions.push(or(like(jobs.name, `%${filters.search}%`), like(jobs.clientName, `%${filters.search}%`)));
  }
  const jobRows = await db
    .select()
    .from(jobs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(jobs.startDate);

  const jobIds = jobRows.map((j) => j.id);
  if (jobIds.length === 0) return [];

  const [staffRows, vehicleRows, extraRows] = await Promise.all([
    db
      .select({ jobId: jobStaffAssignments.jobId, date: jobStaffAssignments.date, name: staff.name })
      .from(jobStaffAssignments)
      .innerJoin(staff, eq(staff.id, jobStaffAssignments.staffId))
      .where(inArray(jobStaffAssignments.jobId, jobIds)),
    db
      .select({ jobId: jobVehicleAssignments.jobId, date: jobVehicleAssignments.date, plateNumber: vehicles.plateNumber })
      .from(jobVehicleAssignments)
      .innerJoin(vehicles, eq(vehicles.id, jobVehicleAssignments.vehicleId))
      .where(inArray(jobVehicleAssignments.jobId, jobIds)),
    db
      .select({
        jobId: jobDayExtras.jobId,
        date: jobDayExtras.date,
        outsourceCrewCount: jobDayExtras.outsourceCrewCount,
        outsourceTruckCount: jobDayExtras.outsourceTruckCount,
      })
      .from(jobDayExtras)
      .where(inArray(jobDayExtras.jobId, jobIds)),
  ]);

  const dayByJob = new Map<string, Map<string, JobListDaySummary>>();
  function dayFor(jobId: string, date: string) {
    if (!dayByJob.has(jobId)) dayByJob.set(jobId, new Map());
    const jobMap = dayByJob.get(jobId)!;
    if (!jobMap.has(date)) {
      jobMap.set(date, { date, staffNames: [], vehiclePlates: [], outsourceCrewCount: 0, outsourceTruckCount: 0 });
    }
    return jobMap.get(date)!;
  }
  for (const row of staffRows) dayFor(row.jobId, row.date).staffNames.push(row.name);
  for (const row of vehicleRows) dayFor(row.jobId, row.date).vehiclePlates.push(row.plateNumber);
  for (const row of extraRows) {
    const day = dayFor(row.jobId, row.date);
    day.outsourceCrewCount = row.outsourceCrewCount;
    day.outsourceTruckCount = row.outsourceTruckCount;
  }

  return jobRows.map((job) => {
    const dayMap = dayByJob.get(job.id);
    const dayAssignments = dayMap ? [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date)) : [];
    return { ...job, dayAssignments };
  });
}

export async function getJobWithAssignments(id: string) {
  const jobRows = await db.select().from(jobs).where(eq(jobs.id, id));
  const job = jobRows[0];
  if (!job) return undefined;

  const staffRows = await db
    .select({ date: jobStaffAssignments.date, staff })
    .from(jobStaffAssignments)
    .innerJoin(staff, eq(staff.id, jobStaffAssignments.staffId))
    .where(eq(jobStaffAssignments.jobId, id));

  const vehicleRows = await db
    .select({ date: jobVehicleAssignments.date, vehicle: vehicles })
    .from(jobVehicleAssignments)
    .innerJoin(vehicles, eq(vehicles.id, jobVehicleAssignments.vehicleId))
    .where(eq(jobVehicleAssignments.jobId, id));

  const extraRows = await db
    .select({
      date: jobDayExtras.date,
      outsourceCrewCount: jobDayExtras.outsourceCrewCount,
      outsourceTruckCount: jobDayExtras.outsourceTruckCount,
    })
    .from(jobDayExtras)
    .where(eq(jobDayExtras.jobId, id));

  const byDate = new Map<string, JobDayAssignment>();
  function dayFor(date: string) {
    let entry = byDate.get(date);
    if (!entry) {
      entry = { date, staff: [], vehicles: [], outsourceCrewCount: 0, outsourceTruckCount: 0 };
      byDate.set(date, entry);
    }
    return entry;
  }
  for (const row of staffRows) dayFor(row.date).staff.push(row.staff);
  for (const row of vehicleRows) dayFor(row.date).vehicles.push(row.vehicle);
  for (const row of extraRows) {
    const day = dayFor(row.date);
    day.outsourceCrewCount = row.outsourceCrewCount;
    day.outsourceTruckCount = row.outsourceTruckCount;
  }

  const dayAssignments = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const attachments = await db
    .select({
      id: jobAttachments.id,
      fileName: jobAttachments.fileName,
      mimeType: jobAttachments.mimeType,
      fileSize: jobAttachments.fileSize,
      createdAt: jobAttachments.createdAt,
    })
    .from(jobAttachments)
    .where(eq(jobAttachments.jobId, id));

  return { ...job, dayAssignments, attachments };
}

async function assertNoDateConflicts(dayAssignments: DayAssignment[], excludeJobId?: string) {
  const dates = dayAssignments.map((d) => d.date);
  if (dates.length === 0) return;

  const conflictsByDate = await getConflictsByDate({ dates, excludeJobId });

  const staffHits: { date: string; staffId: string; jobName: string }[] = [];
  const vehicleHits: { date: string; vehicleId: string; jobName: string }[] = [];

  for (const day of dayAssignments) {
    const dateStatus = conflictsByDate[day.date];
    if (!dateStatus) continue;
    for (const staffId of day.staffIds) {
      const conflict = dateStatus.staffConflicts[staffId];
      if (conflict?.length) staffHits.push({ date: day.date, staffId, jobName: conflict[0].jobName });
    }
    for (const vehicleId of day.vehicleIds) {
      const conflict = dateStatus.vehicleConflicts[vehicleId];
      if (conflict?.length) vehicleHits.push({ date: day.date, vehicleId, jobName: conflict[0].jobName });
    }
  }

  if (staffHits.length === 0 && vehicleHits.length === 0) return;

  const [staffRows, vehicleRows] = await Promise.all([
    staffHits.length > 0
      ? db.select().from(staff).where(inArray(staff.id, [...new Set(staffHits.map((h) => h.staffId))]))
      : Promise.resolve([]),
    vehicleHits.length > 0
      ? db.select().from(vehicles).where(inArray(vehicles.id, [...new Set(vehicleHits.map((h) => h.vehicleId))]))
      : Promise.resolve([]),
  ]);
  const staffNameById = new Map(staffRows.map((s) => [s.id, s.name]));
  const vehiclePlateById = new Map(vehicleRows.map((v) => [v.id, v.plateNumber]));

  const messages = [
    ...staffHits.map((h) => `${staffNameById.get(h.staffId) ?? h.staffId} ติดงาน "${h.jobName}" วันที่ ${h.date}`),
    ...vehicleHits.map((h) => `${vehiclePlateById.get(h.vehicleId) ?? h.vehicleId} ติดงาน "${h.jobName}" วันที่ ${h.date}`),
  ];

  throw new AppError(409, `บันทึกไม่ได้ เนื่องจากติดงานซ้อน: ${messages.join("; ")}`);
}

async function insertDayAssignments(
  tx: { insert: typeof db.insert },
  jobId: string,
  dayAssignments: DayAssignment[],
) {
  const staffRows = dayAssignments.flatMap((day) =>
    day.staffIds.map((staffId) => ({ jobId, staffId, date: day.date })),
  );
  const vehicleRows = dayAssignments.flatMap((day) =>
    day.vehicleIds.map((vehicleId) => ({ jobId, vehicleId, date: day.date })),
  );
  const extraRows = dayAssignments.map((day) => ({
    jobId,
    date: day.date,
    outsourceCrewCount: day.outsourceCrewCount,
    outsourceTruckCount: day.outsourceTruckCount,
  }));
  if (staffRows.length > 0) {
    await tx.insert(jobStaffAssignments).values(staffRows);
  }
  if (vehicleRows.length > 0) {
    await tx.insert(jobVehicleAssignments).values(vehicleRows);
  }
  if (extraRows.length > 0) {
    await tx.insert(jobDayExtras).values(extraRows);
  }
}

export async function createJobWithAssignments(input: JobWithAssignmentsInput) {
  const { dayAssignments, ...jobFields } = input;

  await assertNoDateConflicts(dayAssignments);

  return db.transaction(async (tx) => {
    const [job] = await tx.insert(jobs).values(jobFields).returning();
    await insertDayAssignments(tx, job.id, dayAssignments);
    return job;
  });
}

export async function updateJobWithAssignments(
  id: string,
  input: Partial<JobWithAssignmentsInput>,
) {
  const { dayAssignments, ...jobFields } = input;

  if (dayAssignments !== undefined) {
    await assertNoDateConflicts(dayAssignments, id);
  }

  return db.transaction(async (tx) => {
    let job;
    if (Object.keys(jobFields).length > 0) {
      [job] = await tx.update(jobs).set(jobFields).where(eq(jobs.id, id)).returning();
    } else {
      [job] = await tx.select().from(jobs).where(eq(jobs.id, id));
    }

    if (dayAssignments !== undefined) {
      await tx.delete(jobStaffAssignments).where(eq(jobStaffAssignments.jobId, id));
      await tx.delete(jobVehicleAssignments).where(eq(jobVehicleAssignments.jobId, id));
      await tx.delete(jobDayExtras).where(eq(jobDayExtras.jobId, id));
      await insertDayAssignments(tx, id, dayAssignments);
    }

    return job;
  });
}

export async function deleteJob(id: string) {
  await db.delete(jobs).where(eq(jobs.id, id));
}

export async function updateJobFields(id: string, input: JobUpdate) {
  const rows = await db.update(jobs).set(input).where(eq(jobs.id, id)).returning();
  return rows[0];
}
