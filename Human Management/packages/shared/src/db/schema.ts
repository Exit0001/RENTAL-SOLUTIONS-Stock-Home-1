import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const availabilityStatusValues = ["available", "unavailable", "on_leave"] as const;
const jobStatusValues = ["tentative", "confirmed", "completed", "cancelled"] as const;

function id() {
  return text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
}

function timestamps() {
  return {
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  };
}

export const staff = sqliteTable("staff", {
  id: id(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  phone: text("phone"),
  status: text("status", { enum: availabilityStatusValues }).notNull().default("available"),
  notes: text("notes"),
  ...timestamps(),
});

export const vehicles = sqliteTable("vehicles", {
  id: id(),
  plateNumber: text("plate_number").notNull().unique(),
  vehicleType: text("vehicle_type").notNull(),
  status: text("status", { enum: availabilityStatusValues }).notNull().default("available"),
  notes: text("notes"),
  ...timestamps(),
});

export const jobs = sqliteTable("jobs", {
  id: id(),
  name: text("name").notNull(),
  clientName: text("client_name").notNull(),
  location: text("location"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  status: text("status", { enum: jobStatusValues }).notNull().default("tentative"),
  notes: text("notes"),
  ...timestamps(),
});

export const jobStaffAssignments = sqliteTable(
  "job_staff_assignments",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    roleOnJob: text("role_on_job"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({ uqJobStaff: uniqueIndex("uq_job_staff").on(table.jobId, table.staffId, table.date) }),
);

export const jobVehicleAssignments = sqliteTable(
  "job_vehicle_assignments",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({ uqJobVehicle: uniqueIndex("uq_job_vehicle").on(table.jobId, table.vehicleId, table.date) }),
);

export const jobDayExtras = sqliteTable(
  "job_day_extras",
  {
    id: id(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    outsourceCrewCount: integer("outsource_crew_count").notNull().default(0),
    outsourceTruckCount: integer("outsource_truck_count").notNull().default(0),
  },
  (table) => ({ uqJobDayExtras: uniqueIndex("uq_job_day_extras").on(table.jobId, table.date) }),
);

export const jobAttachments = sqliteTable("job_attachments", {
  id: id(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
