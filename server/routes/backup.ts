import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  companies, users, stockItems, stockUnits, containers, containerUnits, itemAccessories,
  jobs, jobExpenses, jobVehicles, jobStock, jobCrew, jobUnits, jobContainers,
  jobTemplates, jobTemplateItems, equipmentSets, equipmentSetItems,
  pullSheets, maintenanceLogs, subRentals, quotes, invoices, incidents, activityLog,
  notifications, brands, categories, subCategories, locations, positions, containerTypes,
} from "@shared/schema";

export const backupRouter = Router();

// GET /api/backup/export — ดาวน์โหลดข้อมูล "เฉพาะบริษัทของผู้ใช้" เป็นไฟล์ JSON (Admin เท่านั้น)
// multi-tenant safe: ทุก query filter ด้วย companyId — ไม่มีทางหลุดข้อมูลบริษัทอื่น
// ไม่รวม push_subscriptions (device token ชั่วคราว + เป็นความลับ ไม่มีประโยชน์ในไฟล์สำรอง)
backupRouter.get("/export", async (req, res) => {
  try {
    if (req.userRole !== "admin")
      return res.status(403).json({ message: "เฉพาะ Admin เท่านั้นที่ export ข้อมูลได้" });

    const companyId = req.companyId;
    const byCompany = <T extends { companyId: any }>(tbl: T) =>
      db.select().from(tbl as any).where(eq((tbl as any).companyId, companyId));

    // ── ตารางที่มี company_id ตรงๆ ──────────────────────────────
    const [
      company, usersRows, stockItemsRows, stockUnitsRows, containersRows, itemAccessoriesRows,
      jobsRows, jobExpensesRows, jobVehiclesRows, jobTemplatesRows, equipmentSetsRows,
      pullSheetsRows, maintenanceLogsRows, subRentalsRows, quotesRows, invoicesRows,
      incidentsRows, activityLogRows, notificationsRows,
      brandsRows, categoriesRows, subCategoriesRows, locationsRows, positionsRows, containerTypesRows,
    ] = await Promise.all([
      db.select().from(companies).where(eq(companies.id, companyId)),
      byCompany(users), byCompany(stockItems), byCompany(stockUnits), byCompany(containers),
      byCompany(itemAccessories), byCompany(jobs), byCompany(jobExpenses), byCompany(jobVehicles),
      byCompany(jobTemplates), byCompany(equipmentSets), byCompany(pullSheets),
      byCompany(maintenanceLogs), byCompany(subRentals), byCompany(quotes), byCompany(invoices),
      byCompany(incidents), byCompany(activityLog), byCompany(notifications),
      byCompany(brands), byCompany(categories), byCompany(subCategories), byCompany(locations),
      byCompany(positions), byCompany(containerTypes),
    ]);

    // ── ตารางลูก (ไม่มี company_id) — filter ด้วย id ของ parent ──
    const containerIds = containersRows.map((c) => c.id);
    const jobIds       = jobsRows.map((j) => j.id);
    const templateIds  = jobTemplatesRows.map((t) => t.id);
    const setIds       = equipmentSetsRows.map((s) => s.id);

    const [
      containerUnitsRows, jobStockRows, jobCrewRows, jobUnitsRows, jobContainersRows,
      jobTemplateItemsRows, equipmentSetItemsRows,
    ] = await Promise.all([
      containerIds.length ? db.select().from(containerUnits).where(inArray(containerUnits.containerId, containerIds)) : [],
      jobIds.length ? db.select().from(jobStock).where(inArray(jobStock.jobId, jobIds)) : [],
      jobIds.length ? db.select().from(jobCrew).where(inArray(jobCrew.jobId, jobIds)) : [],
      jobIds.length ? db.select().from(jobUnits).where(inArray(jobUnits.jobId, jobIds)) : [],
      jobIds.length ? db.select().from(jobContainers).where(inArray(jobContainers.jobId, jobIds)) : [],
      templateIds.length ? db.select().from(jobTemplateItems).where(inArray(jobTemplateItems.templateId, templateIds)) : [],
      setIds.length ? db.select().from(equipmentSetItems).where(inArray(equipmentSetItems.setId, setIds)) : [],
    ]);

    const data = {
      companies: company, users: usersRows,
      brands: brandsRows, categories: categoriesRows, sub_categories: subCategoriesRows,
      locations: locationsRows, positions: positionsRows, container_types: containerTypesRows,
      stock_items: stockItemsRows, stock_units: stockUnitsRows, item_accessories: itemAccessoriesRows,
      containers: containersRows, container_units: containerUnitsRows,
      equipment_sets: equipmentSetsRows, equipment_set_items: equipmentSetItemsRows,
      job_templates: jobTemplatesRows, job_template_items: jobTemplateItemsRows,
      jobs: jobsRows, job_stock: jobStockRows, job_units: jobUnitsRows, job_containers: jobContainersRows,
      job_crew: jobCrewRows, job_expenses: jobExpensesRows, job_vehicles: jobVehiclesRows,
      pull_sheets: pullSheetsRows, sub_rentals: subRentalsRows,
      quotes: quotesRows, invoices: invoicesRows, incidents: incidentsRows,
      maintenance_logs: maintenanceLogsRows, activity_log: activityLogRows, notifications: notificationsRows,
    };

    const rowCount = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, (v as any[]).length]));

    const payload = {
      meta: {
        app: "STAK",
        version: "2.0",
        kind: "company-data-backup",
        companyId,
        companyName: company[0]?.name ?? null,
        exportedAt: new Date().toISOString(),
        exportedBy: req.userId,
        rowCount,
      },
      data,
    };

    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = (company[0]?.name ?? "company").replace(/[^a-zA-Z0-9ก-๙_-]+/g, "_");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="stak-backup-${safeName}-${stamp}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Export failed" });
  }
});
