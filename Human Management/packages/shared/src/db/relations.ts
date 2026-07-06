import { relations } from "drizzle-orm";
import { jobs, staff, vehicles, jobStaffAssignments, jobVehicleAssignments } from "./schema";

export const jobsRelations = relations(jobs, ({ many }) => ({
  staffAssignments: many(jobStaffAssignments),
  vehicleAssignments: many(jobVehicleAssignments),
}));

export const staffRelations = relations(staff, ({ many }) => ({
  jobAssignments: many(jobStaffAssignments),
}));

export const vehiclesRelations = relations(vehicles, ({ many }) => ({
  jobAssignments: many(jobVehicleAssignments),
}));

export const jobStaffAssignmentsRelations = relations(jobStaffAssignments, ({ one }) => ({
  job: one(jobs, { fields: [jobStaffAssignments.jobId], references: [jobs.id] }),
  staffMember: one(staff, { fields: [jobStaffAssignments.staffId], references: [staff.id] }),
}));

export const jobVehicleAssignmentsRelations = relations(jobVehicleAssignments, ({ one }) => ({
  job: one(jobs, { fields: [jobVehicleAssignments.jobId], references: [jobs.id] }),
  vehicle: one(vehicles, { fields: [jobVehicleAssignments.vehicleId], references: [vehicles.id] }),
}));
