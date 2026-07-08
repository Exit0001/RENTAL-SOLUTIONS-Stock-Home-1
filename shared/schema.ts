// Database Schema — STAK Rental Management
// ทุก table ที่เก็บข้อมูลธุรกิจจะมี company_id เสมอ
// เพื่อรองรับ multi-tenant (หลายบริษัทในฐานข้อมูลเดียว)

import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  decimal,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────────────────────
// ENUMS — ค่าที่เป็นไปได้สำหรับแต่ละ field
// PostgreSQL จะ enforce ว่าต้องเป็นค่าในรายการเท่านั้น
// ─────────────────────────────────────────────

export const planEnum = pgEnum("plan", ["free", "pro", "enterprise"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "crew"]);
export const stockUnitStatusEnum = pgEnum("stock_unit_status", ["available", "out", "maintenance", "retired"]);
export const jobStatusEnum = pgEnum("job_status", ["draft", "scheduled", "active", "completed", "cancelled"]);
export const pullSheetStatusEnum = pgEnum("pull_sheet_status", ["draft", "pending", "dispatched", "returned"]);
export const maintenanceTypeEnum = pgEnum("maintenance_type", ["repair", "preventive", "inspection"]);
export const maintenanceStatusEnum = pgEnum("maintenance_status", ["in_progress", "completed"]);
export const subRentalStatusEnum = pgEnum("sub_rental_status", ["active", "pending", "returned"]);
export const quoteStatusEnum = pgEnum("quote_status", ["draft", "sent", "accepted", "declined"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "paid", "overdue"]);
export const incidentSeverityEnum = pgEnum("incident_severity", ["low", "medium", "high"]);
export const incidentStatusEnum = pgEnum("incident_status", ["open", "resolved"]);
export const activityTypeEnum = pgEnum("activity_type", ["stock", "finance", "maintenance", "jobs"]);
export const jobExpenseCategoryEnum = pgEnum("job_expense_category", ["staff", "transport"]);
export const jobUnitPhaseEnum        = pgEnum("job_unit_phase", ["planned", "prepared", "dispatched", "returned"]);
export const stockTrackingModeEnum  = pgEnum("stock_tracking_mode", ["unit", "bulk"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "job_assigned", "job_removed", "job_updated",
  "pullsheet_assigned", "maintenance_assigned", "stock_added",
]);

// ─────────────────────────────────────────────
// 1. COMPANIES — บริษัทที่ใช้แอป (แต่ละแถว = 1 บริษัท)
// ─────────────────────────────────────────────

export const companies = pgTable("companies", {
  id:        uuid("id").primaryKey().defaultRandom(),
  name:      text("name").notNull(),
  slug:      text("slug").notNull().unique(),  // ใช้ใน URL เช่น stak.app/my-company
  plan:      planEnum("plan").default("free").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // LINE group push notifications — ส่งข้อความเข้ากลุ่ม LINE เมื่อมีงานใหม่
  lineChannelAccessToken: text("line_channel_access_token"),
  lineGroupId:            text("line_group_id"),
});

// ─────────────────────────────────────────────
// 2. USERS — พนักงานของแต่ละบริษัท
// ─────────────────────────────────────────────

export const users = pgTable("users", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  authId:    text("auth_id").unique(),   // Supabase auth user ID
  username:  text("username").notNull().unique(),
  password:  text("password").notNull(),
  name:      text("name").notNull(),
  initials:  text("initials").notNull(),
  role:      userRoleEnum("role").default("crew").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 3. STOCK ITEMS — หมวดหมู่อุปกรณ์ (เช่น "J8 Loudspeaker" มี 24 ตัว)
// ─────────────────────────────────────────────

export const stockItems = pgTable("stock_items", {
  id:          uuid("id").primaryKey().defaultRandom(),
  companyId:   uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:        text("name").notNull(),
  brand:       text("brand").notNull(),
  category:    text("category").notNull(),
  subCategory: text("sub_category").notNull(),
  quantity:     integer("quantity").default(0).notNull(),
  trackingMode: stockTrackingModeEnum("tracking_mode").default("unit").notNull(),

  // General — รายละเอียดเพิ่มเติม
  manufacturer:        text("manufacturer"),
  manufacturerCountry: text("manufacturer_country"),
  description:         text("description"),
  imageUrl:            text("image_url"),

  // Pricing & Finance
  purchaseCost:     decimal("purchase_cost", { precision: 12, scale: 2 }),
  purchaseDate:     timestamp("purchase_date"),
  dailyRate:        decimal("daily_rate", { precision: 10, scale: 2 }),
  weeklyRate:       decimal("weekly_rate", { precision: 10, scale: 2 }),
  replacementValue: decimal("replacement_value", { precision: 12, scale: 2 }),
  securityDeposit:  decimal("security_deposit", { precision: 10, scale: 2 }),

  // Logistics & Specs
  weight:     decimal("weight", { precision: 8, scale: 2 }),
  dimensions: text("dimensions"),
  specs:      jsonb("specs").$type<{
    template?: string;
    fields?: Record<string, string>;
    customFields?: { key: string; label: string; value: string }[];
    protocolTags?: string[];
    customProtocolOptions?: string[];
  }>(),

  // Documents & Warranty (ลิงก์ไฟล์ — Supabase Storage)
  warrantyExpiry: timestamp("warranty_expiry"),
  supplierName:   text("supplier_name"),
  supportContact: text("support_contact"),
  manualUrl:      text("manual_url"),
  certUrl:        text("cert_url"),
  invoiceUrl:     text("invoice_url"),

  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("stock_items_company_id_idx").on(t.companyId),
]);

// ─────────────────────────────────────────────
// 4. STOCK UNITS — หน่วยย่อยแต่ละชิ้น (เช่น "J8 Top1" serial Z330...)
// ─────────────────────────────────────────────

export const stockUnits = pgTable("stock_units", {
  id:                uuid("id").primaryKey().defaultRandom(),
  companyId:         uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  stockItemId:       uuid("stock_item_id").references(() => stockItems.id, { onDelete: "cascade" }).notNull(),
  name:              text("name").notNull(),
  serialNumber:      text("serial_number"),
  barcode:           text("barcode"),
  location:          text("location"),
  status:            stockUnitStatusEnum("status").default("available").notNull(),
  healthScore:       integer("health_score").default(100),
  purchasedAt:       timestamp("purchased_at"),
  warrantyExpiresAt: timestamp("warranty_expires_at"),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("stock_units_company_id_idx").on(t.companyId),
  index("stock_units_stock_item_id_idx").on(t.stockItemId),
]);

// ─────────────────────────────────────────────
// 5. CONTAINERS — ลัง/ราก ที่บรรจุอุปกรณ์
// ─────────────────────────────────────────────

export const containers = pgTable("containers", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:      text("name").notNull(),
  type:      text("type").notNull(),
  location:  text("location"),
  barcode:   text("barcode"),
  isOut:     boolean("is_out").default(false).notNull(),  // check out ไปแล้วหรือยัง
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 6. CONTAINER UNITS — อุปกรณ์ชิ้นไหนอยู่ใน container ไหน
// (junction table — เชื่อม 2 table เข้าหากัน)
// ─────────────────────────────────────────────

export const containerUnits = pgTable("container_units", {
  id:          uuid("id").primaryKey().defaultRandom(),
  containerId: uuid("container_id").references(() => containers.id, { onDelete: "cascade" }).notNull(),
  stockUnitId: uuid("stock_unit_id").references(() => stockUnits.id, { onDelete: "cascade" }).notNull(),
}, (t) => [
  index("container_units_container_id_idx").on(t.containerId),
  index("container_units_stock_unit_id_idx").on(t.stockUnitId),
]);

// ─────────────────────────────────────────────
// 6b. ITEM ACCESSORIES — อุปกรณ์เสริมที่ต้องไปพร้อมกัน
// ─────────────────────────────────────────────

export const itemAccessories = pgTable("item_accessories", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  companyId:            uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  parentStockItemId:    uuid("parent_stock_item_id").references(() => stockItems.id, { onDelete: "cascade" }).notNull(),
  accessoryStockItemId: uuid("accessory_stock_item_id").references(() => stockItems.id, { onDelete: "cascade" }).notNull(),
  quantityPerUnit:      integer("quantity_per_unit").default(1).notNull(),
  required:             boolean("required").default(true).notNull(),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 7. JOBS — งานให้เช่า (events, concerts, conferences)
// ─────────────────────────────────────────────

export const jobs = pgTable("jobs", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:      text("name").notNull(),
  client:    text("client").notNull(),
  location:  text("location"),
  rehearsalDate: timestamp("rehearsal_date"),
  startDate:     timestamp("start_date").notNull(),
  endDate:       timestamp("end_date").notNull(),
  status:        jobStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("jobs_company_id_idx").on(t.companyId),
]);

// ─────────────────────────────────────────────
// 7b. JOB EXPENSES — ค่าใช้จ่ายเพิ่มเติมของงาน (ค่าเด็กโหลด, ค่าเดินทาง/ส่งของ) พร้อมสลิป
// ─────────────────────────────────────────────

export const jobExpenses = pgTable("job_expenses", {
  id:         uuid("id").primaryKey().defaultRandom(),
  companyId:  uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  jobId:      uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  category:   jobExpenseCategoryEnum("category").notNull(),
  amount:     decimal("amount", { precision: 10, scale: 2 }).notNull(),
  note:       text("note"),
  receiptUrl: text("receipt_url"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 7c. JOB VEHICLES — รถที่ใช้ในงาน (เช่น รถ 6 ล้อ, กระบะ) — ข้อมูล logistics ไม่ผูกกับต้นทุน
// ─────────────────────────────────────────────

export const jobVehicles = pgTable("job_vehicles", {
  id:          uuid("id").primaryKey().defaultRandom(),
  companyId:   uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  jobId:       uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  vehicleType: text("vehicle_type").notNull(),
  note:        text("note"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 8. JOB STOCK — อุปกรณ์ที่ assign ให้แต่ละงาน
// ─────────────────────────────────────────────

export const jobStock = pgTable("job_stock", {
  id:          uuid("id").primaryKey().defaultRandom(),
  jobId:       uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  stockItemId: uuid("stock_item_id").references(() => stockItems.id, { onDelete: "cascade" }).notNull(),
  quantity:    integer("quantity").notNull(),
  position:    text("position"),  // โซนในงาน เช่น FOH / Monitors / Power / Stage (per-job)
}, (t) => [
  index("job_stock_job_id_idx").on(t.jobId),
  index("job_stock_stock_item_id_idx").on(t.stockItemId),
]);

// ─────────────────────────────────────────────
// 9. JOB CREW — พนักงานที่ assign ให้แต่ละงาน
// ─────────────────────────────────────────────

export const jobCrew = pgTable("job_crew", {
  id:     uuid("id").primaryKey().defaultRandom(),
  jobId:  uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  role:   text("role"),  // บทบาทในงานนี้ เช่น "Lead Engineer"
}, (t) => [
  index("job_crew_job_id_idx").on(t.jobId),
  index("job_crew_user_id_idx").on(t.userId),
]);

// ─────────────────────────────────────────────
// 10b. JOB UNITS — individual units ที่ assign ให้งาน (รู้ชัดว่า serial ไหนออกงานไหน)
// ─────────────────────────────────────────────

export const jobUnits = pgTable("job_units", {
  id:          uuid("id").primaryKey().defaultRandom(),
  jobId:       uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  stockUnitId: uuid("stock_unit_id").references(() => stockUnits.id, { onDelete: "cascade" }).notNull(),
  phase:       jobUnitPhaseEnum("phase").default("planned").notNull(),
  position:    text("position"),  // โซนในงาน เช่น FOH / Monitors / Power / Stage (per-job)
}, (t) => [
  index("job_units_job_id_idx").on(t.jobId),
  index("job_units_stock_unit_id_idx").on(t.stockUnitId),
]);

// ─────────────────────────────────────────────
// 10c. JOB CONTAINERS — rack/case ที่ assign ให้งาน (ทั้งแร็คออกไปกับงานนี้)
// ─────────────────────────────────────────────

export const jobContainers = pgTable("job_containers", {
  id:          uuid("id").primaryKey().defaultRandom(),
  jobId:       uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  containerId: uuid("container_id").references(() => containers.id, { onDelete: "cascade" }).notNull(),
}, (t) => [
  index("job_containers_job_id_idx").on(t.jobId),
  index("job_containers_container_id_idx").on(t.containerId),
]);

// ─────────────────────────────────────────────
// 10d. JOB TEMPLATES — เทมเพลตชุดอุปกรณ์มาตรฐาน (เช่น Full Band, Small PA)
// เก็บระดับ item + จำนวน (ไม่ผูก serial เฉพาะ) — ตอนสร้างงานค่อย auto-assign unit ที่ว่าง
// ─────────────────────────────────────────────

export const jobTemplates = pgTable("job_templates", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:      text("name").notNull(),
  notes:     text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("job_templates_company_id_idx").on(t.companyId),
]);

export const jobTemplateItems = pgTable("job_template_items", {
  id:          uuid("id").primaryKey().defaultRandom(),
  templateId:  uuid("template_id").references(() => jobTemplates.id, { onDelete: "cascade" }).notNull(),
  stockItemId: uuid("stock_item_id").references(() => stockItems.id, { onDelete: "cascade" }).notNull(),
  quantity:    integer("quantity").notNull(),
}, (t) => [
  index("job_template_items_template_id_idx").on(t.templateId),
]);

// ─────────────────────────────────────────────
// 10. PULL SHEETS — รายการเบิกอุปกรณ์ก่อนออกงาน
// ─────────────────────────────────────────────

export const pullSheets = pgTable("pull_sheets", {
  id:          uuid("id").primaryKey().defaultRandom(),
  companyId:   uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  jobId:       uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  createdById: uuid("created_by").references(() => users.id).notNull(),
  assigneeId:  uuid("assignee_id").references(() => users.id),
  status:      pullSheetStatusEnum("status").default("draft").notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 11. MAINTENANCE LOGS — ประวัติการซ่อมบำรุง
// ─────────────────────────────────────────────

export const maintenanceLogs = pgTable("maintenance_logs", {
  id:          uuid("id").primaryKey().defaultRandom(),
  companyId:   uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  stockUnitId: uuid("stock_unit_id").references(() => stockUnits.id, { onDelete: "set null" }),
  type:        maintenanceTypeEnum("type").notNull(),
  description: text("description").notNull(),
  techId:      uuid("tech_id").references(() => users.id),  // ช่างที่รับผิดชอบ
  status:      maintenanceStatusEnum("status").default("in_progress").notNull(),
  cost:        decimal("cost", { precision: 10, scale: 2 }),  // เก็บทศนิยม 2 ตำแหน่ง
  receiptUrl:  text("receipt_url"),  // ลิงก์ใบเสร็จ/บิลค่าซ่อม (Supabase Storage)
  date:        timestamp("date").notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 12. SUB RENTALS — อุปกรณ์ที่ยืมมาจากบริษัทอื่น
// ─────────────────────────────────────────────

export const subRentals = pgTable("sub_rentals", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  jobId:     uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  itemName:  text("item_name").notNull(),
  partner:   text("partner").notNull(),   // บริษัทที่ยืมมา
  dueBack:   timestamp("due_back").notNull(),
  dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }),
  receiptUrl:text("receipt_url"),  // ลิงก์ใบเสร็จ/บิลค่าเช่า (Supabase Storage)
  status:    subRentalStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 13. QUOTES — ใบเสนอราคา
// ─────────────────────────────────────────────

export const quotes = pgTable("quotes", {
  id:           uuid("id").primaryKey().defaultRandom(),
  companyId:    uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  jobId:        uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  quoteNumber:  text("quote_number").notNull(),  // เช่น "QT-018"
  client:       text("client").notNull(),
  totalValue:   decimal("total_value", { precision: 10, scale: 2 }).notNull(),
  status:       quoteStatusEnum("status").default("draft").notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 14. INVOICES — ใบแจ้งหนี้
// ─────────────────────────────────────────────

export const invoices = pgTable("invoices", {
  id:            uuid("id").primaryKey().defaultRandom(),
  companyId:     uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  jobId:         uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  invoiceNumber: text("invoice_number").notNull(),  // เช่น "INV-0045"
  client:        text("client").notNull(),
  amount:        decimal("amount", { precision: 10, scale: 2 }).notNull(),
  issuedDate:    timestamp("issued_date").notNull(),
  dueDate:       timestamp("due_date").notNull(),
  status:        invoiceStatusEnum("status").default("pending").notNull(),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 15. INCIDENTS — รายงานความเสียหาย/สูญหาย
// ─────────────────────────────────────────────

export const incidents = pgTable("incidents", {
  id:          uuid("id").primaryKey().defaultRandom(),
  companyId:   uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  stockUnitId: uuid("stock_unit_id").references(() => stockUnits.id, { onDelete: "set null" }),
  jobId:       uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  reporterId:  uuid("reporter_id").references(() => users.id).notNull(),
  description: text("description").notNull(),
  severity:    incidentSeverityEnum("severity").notNull(),
  status:      incidentStatusEnum("status").default("open").notNull(),
  hasPhoto:    boolean("has_photo").default(false).notNull(),
  photoUrl:    text("photo_url"),  // ลิงก์รูปหลักฐาน (Supabase Storage)
  date:        timestamp("date").notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 16. ACTIVITY LOG — ประวัติทุกการกระทำ (สำหรับหน้า History)
// ─────────────────────────────────────────────

export const activityLog = pgTable("activity_log", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  userId:    uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  type:      activityTypeEnum("type").notNull(),
  action:    text("action").notNull(),   // เช่น "Checked Out"
  detail:    text("detail").notNull(),   // เช่น "24x J8 → Festival Sound 2026"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 16b. NOTIFICATIONS — แจ้งเตือนรายบุคคล (per-user)
// ─────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  userId:    uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),  // ผู้รับแจ้งเตือน
  actorId:   uuid("actor_id").references(() => users.id, { onDelete: "set null" }),          // ผู้ทำให้เกิดการแจ้งเตือน
  type:      notificationTypeEnum("type").notNull(),
  meta:      jsonb("meta").$type<Record<string, string | number>>().default({}),  // { jobName, status, itemName, actorName, count, ... }
  link:      text("link"),  // ชื่อหน้าสำหรับ setActivePage() เช่น "Jobs" | "Stock" | "Maintenance"
  isRead:    boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("notifications_user_id_idx").on(t.userId),
]);

// ─────────────────────────────────────────────
// 16c. PUSH SUBSCRIPTIONS — Web Push subscription ต่อ device
// ─────────────────────────────────────────────

export const pushSubscriptions = pgTable("push_subscriptions", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  userId:    uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  endpoint:  text("endpoint").notNull().unique(),
  p256dh:    text("p256dh").notNull(),
  auth:      text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 17. CATALOG — Brand / Category / Sub-Category (จัดการได้จากหน้า Stock)
// ─────────────────────────────────────────────

export const brands = pgTable("brands", {
  id:          uuid("id").primaryKey().defaultRandom(),
  companyId:   uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:        text("name").notNull(),
  logoUrl:     text("logo_url"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subCategories = pgTable("sub_categories", {
  id:             uuid("id").primaryKey().defaultRandom(),
  companyId:      uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:           text("name").notNull(),
  parentCategory: text("parent_category").notNull(),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 18. LOCATIONS — สถานที่จัดเก็บสินค้า (จัดการได้จากหน้า Stock)
// ─────────────────────────────────────────────

export const locations = pgTable("locations", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:      text("name").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// 18b. POSITIONS — โซน/ตำแหน่งในงาน (FOH / Monitors / Power / Stage) — pick-list ต่อบริษัท
// ใช้ติดแท็กอุปกรณ์ต่องาน (job_units.position / job_stock.position) เพื่อจัด pull sheet + แพ็กตามโซน
// ─────────────────────────────────────────────

export const positions = pgTable("positions", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:      text("name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("positions_company_id_idx").on(t.companyId),
]);

// ─────────────────────────────────────────────
// 19. CONTAINER TYPES — ประเภท container ที่กำหนดเองได้ (จัดการได้จากหน้า Stock)
// ─────────────────────────────────────────────

export const containerTypes = pgTable("container_types", {
  id:        uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }).notNull(),
  name:      text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// RELATIONS — บอก Drizzle ว่าแต่ละ table เชื่อมกับใคร
// ใช้สำหรับ query แบบ JOIN ที่ type-safe
// ─────────────────────────────────────────────

export const companiesRelations = relations(companies, ({ many }) => ({
  users:           many(users),
  stockItems:      many(stockItems),
  containers:      many(containers),
  jobs:            many(jobs),
  maintenanceLogs: many(maintenanceLogs),
  quotes:          many(quotes),
  invoices:        many(invoices),
  incidents:       many(incidents),
  activityLog:     many(activityLog),
}));

export const usersRelations = relations(users, ({ one }) => ({
  company: one(companies, { fields: [users.companyId], references: [companies.id] }),
}));

export const stockItemsRelations = relations(stockItems, ({ one, many }) => ({
  company: one(companies, { fields: [stockItems.companyId], references: [companies.id] }),
  units:   many(stockUnits),
}));

export const stockUnitsRelations = relations(stockUnits, ({ one }) => ({
  company:   one(companies,  { fields: [stockUnits.companyId],   references: [companies.id] }),
  stockItem: one(stockItems, { fields: [stockUnits.stockItemId], references: [stockItems.id] }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  company:     one(companies, { fields: [jobs.companyId], references: [companies.id] }),
  stock:       many(jobStock),
  units:       many(jobUnits),
  containers:  many(jobContainers),
  crew:        many(jobCrew),
  pullSheets:  many(pullSheets),
  subRentals:  many(subRentals),
  quotes:      many(quotes),
  invoices:    many(invoices),
  incidents:   many(incidents),
  expenses:    many(jobExpenses),
  vehicles:    many(jobVehicles),
}));

export const jobExpensesRelations = relations(jobExpenses, ({ one }) => ({
  job: one(jobs, { fields: [jobExpenses.jobId], references: [jobs.id] }),
}));

export const jobVehiclesRelations = relations(jobVehicles, ({ one }) => ({
  job: one(jobs, { fields: [jobVehicles.jobId], references: [jobs.id] }),
}));

export const jobUnitsRelations = relations(jobUnits, ({ one }) => ({
  job:       one(jobs,       { fields: [jobUnits.jobId],       references: [jobs.id] }),
  stockUnit: one(stockUnits, { fields: [jobUnits.stockUnitId], references: [stockUnits.id] }),
}));

export const jobContainersRelations = relations(jobContainers, ({ one }) => ({
  job:       one(jobs,       { fields: [jobContainers.jobId],       references: [jobs.id] }),
  container: one(containers, { fields: [jobContainers.containerId], references: [containers.id] }),
}));

// ─────────────────────────────────────────────
// ZOD SCHEMAS — ใช้ validate ข้อมูลก่อน insert ลง DB
// ─────────────────────────────────────────────

export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export const insertUserSchema    = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertStockItemSchema = createInsertSchema(stockItems).omit({ id: true, createdAt: true });
export const insertStockUnitSchema = createInsertSchema(stockUnits).omit({ id: true, createdAt: true });
export const insertContainerSchema = createInsertSchema(containers).omit({ id: true, createdAt: true });
export const insertJobSchema       = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertMaintenanceLogSchema = createInsertSchema(maintenanceLogs, {
  date: z.coerce.date(),
}).omit({ id: true, createdAt: true });

// บันทึกซ่อมหลายชิ้นพร้อมกัน — stockUnitIds: รายการ unit ที่ต้องซ่อม (ว่างได้ = บันทึกทั่วไป)
export const insertMaintenanceLogBatchSchema = insertMaintenanceLogSchema
  .omit({ companyId: true, stockUnitId: true })
  .extend({ stockUnitIds: z.array(z.string()).default([]) });
export const insertSubRentalSchema = createInsertSchema(subRentals).omit({ id: true, createdAt: true });
export const insertQuoteSchema     = createInsertSchema(quotes).omit({ id: true, createdAt: true });
export const insertInvoiceSchema   = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export const insertIncidentSchema  = createInsertSchema(incidents).omit({ id: true, createdAt: true });
export const insertJobExpenseSchema = createInsertSchema(jobExpenses).omit({ id: true, createdAt: true });
export const insertJobVehicleSchema = createInsertSchema(jobVehicles).omit({ id: true, createdAt: true });
export const insertBrandSchema        = createInsertSchema(brands).omit({ id: true, createdAt: true });
export const insertCategorySchema     = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertSubCategorySchema  = createInsertSchema(subCategories).omit({ id: true, createdAt: true });
export const insertLocationSchema     = createInsertSchema(locations).omit({ id: true, createdAt: true });
export const insertPositionSchema      = createInsertSchema(positions).omit({ id: true, createdAt: true });
export const insertContainerTypeSchema = createInsertSchema(containerTypes).omit({ id: true, createdAt: true });
export const insertJobUnitSchema      = createInsertSchema(jobUnits).omit({ id: true });
export const insertJobContainerSchema = createInsertSchema(jobContainers).omit({ id: true });
export const insertJobCrewSchema      = createInsertSchema(jobCrew).omit({ id: true });
export const insertPullSheetSchema    = createInsertSchema(pullSheets)
  .omit({ id: true, createdAt: true, companyId: true, createdById: true, status: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export const insertItemAccessorySchema    = createInsertSchema(itemAccessories).omit({ id: true, createdAt: true });
export const insertJobTemplateSchema      = createInsertSchema(jobTemplates).omit({ id: true, createdAt: true });
export const insertJobTemplateItemSchema  = createInsertSchema(jobTemplateItems).omit({ id: true });

// ─────────────────────────────────────────────
// TYPESCRIPT TYPES — type ที่ใช้ใน code ทั้งหมด
// ─────────────────────────────────────────────

export type Company       = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type User       = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type StockItem       = typeof stockItems.$inferSelect;
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;

export type StockUnit       = typeof stockUnits.$inferSelect;
export type InsertStockUnit = z.infer<typeof insertStockUnitSchema>;

export type Container       = typeof containers.$inferSelect;
export type InsertContainer = z.infer<typeof insertContainerSchema>;

export type Job       = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type JobUnit       = typeof jobUnits.$inferSelect;
export type InsertJobUnit = z.infer<typeof insertJobUnitSchema>;

export type JobTemplate           = typeof jobTemplates.$inferSelect;
export type InsertJobTemplate     = z.infer<typeof insertJobTemplateSchema>;
export type JobTemplateItem       = typeof jobTemplateItems.$inferSelect;
export type InsertJobTemplateItem = z.infer<typeof insertJobTemplateItemSchema>;

export type JobContainer       = typeof jobContainers.$inferSelect;
export type InsertJobContainer = z.infer<typeof insertJobContainerSchema>;

export type JobCrew       = typeof jobCrew.$inferSelect;
export type InsertJobCrew = z.infer<typeof insertJobCrewSchema>;

export type PullSheet       = typeof pullSheets.$inferSelect;
export type InsertPullSheet = z.infer<typeof insertPullSheetSchema>;

export type MaintenanceLog       = typeof maintenanceLogs.$inferSelect;
export type InsertMaintenanceLog = z.infer<typeof insertMaintenanceLogSchema>;
export type InsertMaintenanceLogBatch = z.infer<typeof insertMaintenanceLogBatchSchema>;

export type SubRental       = typeof subRentals.$inferSelect;
export type InsertSubRental = z.infer<typeof insertSubRentalSchema>;

export type Quote       = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export type Invoice       = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type Incident       = typeof incidents.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;

export type JobExpense       = typeof jobExpenses.$inferSelect;
export type InsertJobExpense = z.infer<typeof insertJobExpenseSchema>;

export type JobVehicle       = typeof jobVehicles.$inferSelect;
export type InsertJobVehicle = z.infer<typeof insertJobVehicleSchema>;

export type ItemAccessory       = typeof itemAccessories.$inferSelect;
export type InsertItemAccessory = z.infer<typeof insertItemAccessorySchema>;

export type Brand       = typeof brands.$inferSelect;
export type InsertBrand = z.infer<typeof insertBrandSchema>;

export type Category       = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type SubCategory       = typeof subCategories.$inferSelect;
export type InsertSubCategory = z.infer<typeof insertSubCategorySchema>;

export type Location       = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;

export type Position       = typeof positions.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;

export type ContainerType       = typeof containerTypes.$inferSelect;
export type InsertContainerType = z.infer<typeof insertContainerTypeSchema>;

export type Notification       = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationType   = Notification["type"];

export type PushSubscriptionRow       = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscriptionRow = z.infer<typeof insertPushSubscriptionSchema>;
