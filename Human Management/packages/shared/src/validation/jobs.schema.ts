import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { jobs } from "../db/schema";

export const jobSelectSchema = createSelectSchema(jobs);

const jobInsertBase = createInsertSchema(jobs, {
  name: z.string().min(1, "กรุณากรอกชื่องาน"),
  clientName: z.string().min(1, "กรุณากรอกชื่อลูกค้า"),
}).omit({ id: true, createdAt: true, updatedAt: true });

const dateRangeRefinement = {
  message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มงาน",
  path: ["endDate"],
};

export const jobInsertSchema = jobInsertBase.refine(
  (data) => data.endDate >= data.startDate,
  dateRangeRefinement,
);

export const jobUpdateSchema = jobInsertBase.partial();

export const dayAssignmentSchema = z.object({
  date: z.string(),
  staffIds: z.array(z.string().uuid()).default([]),
  vehicleIds: z.array(z.string().uuid()).default([]),
  outsourceCrewCount: z.number().int().min(0).default(0),
  outsourceTruckCount: z.number().int().min(0).default(0),
});

export type DayAssignment = z.infer<typeof dayAssignmentSchema>;

const jobWithAssignmentsBase = jobInsertBase.extend({
  dayAssignments: z.array(dayAssignmentSchema).default([]),
});

export const jobWithAssignmentsSchema = jobWithAssignmentsBase.refine(
  (data) => data.endDate >= data.startDate,
  dateRangeRefinement,
);

export const jobWithAssignmentsUpdateSchema = jobWithAssignmentsBase.partial();

export type Job = z.infer<typeof jobSelectSchema>;
export type JobInsert = z.infer<typeof jobInsertSchema>;
export type JobUpdate = z.infer<typeof jobUpdateSchema>;
export type JobWithAssignmentsInput = z.infer<typeof jobWithAssignmentsSchema>;
