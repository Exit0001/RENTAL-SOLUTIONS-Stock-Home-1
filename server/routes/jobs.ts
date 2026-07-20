import { Router } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db";
import {
  jobs, jobStock, jobCrew, jobUnits, jobContainers, pullSheets, incidents, insertJobSchema,
  insertPullSheetSchema, insertJobCrewSchema, users, activityLog, stockUnits, stockItems, containers, containerUnits, companies,
  jobExpenses, insertJobExpenseSchema, jobVehicles, insertJobVehicleSchema,
  subRentals, insertSubRentalSchema,
  equipmentSets, equipmentSetItems,
  crewMembers, jobCrewMembers, vehicles, jobCrewCounts,
} from "@shared/schema";
import { generatePullSheetPdf } from "../lib/pullsheetPdf";
import { generatePackingSheetPdf } from "../lib/packingSheetPdf";
import { notify } from "../lib/notify";
import { sendLineMessage } from "../lib/line";
import { setUnitsOut, setUnitsAvailable } from "../lib/stockUnitStatus";
import { recalculateUnitHealth } from "../lib/health";

export const jobsRouter = Router();

// สร้าง pull sheet draft อัตโนมัติให้งานที่เพิ่งเข้าสถานะ "scheduled" — ถ้ายังไม่มีอยู่แล้ว
async function ensurePullSheetForJob(jobId: string, companyId: string, createdById: string) {
  const [existing] = await db.select({ id: pullSheets.id }).from(pullSheets).where(eq(pullSheets.jobId, jobId));
  if (existing) return;
  await db.insert(pullSheets).values({ jobId, companyId, createdById, status: "draft" });
}

// รวมอุปกรณ์ของ job จากทั้ง job_stock (กำหนด quantity ตรง) และ job_units (unit ที่ assign จริง ผ่าน Edit Units / scan)
// แล้ว group ตาม stock item พร้อมชื่อและหมวดหมู่
async function getJobEquipment(jobId: string) {
  const [rawStock, assignedUnits] = await Promise.all([
    db.select().from(jobStock).where(eq(jobStock.jobId, jobId)),
    db.select().from(jobUnits).where(eq(jobUnits.jobId, jobId)),
  ]);

  const counts: Record<string, number> = {};
  const zoneByItem: Record<string, string | null> = {};  // โซน per item (per-job)
  for (const s of rawStock) {
    counts[s.stockItemId] = (counts[s.stockItemId] ?? 0) + s.quantity;
    if (s.position && !zoneByItem[s.stockItemId]) zoneByItem[s.stockItemId] = s.position;
  }

  if (assignedUnits.length > 0) {
    const unitIds   = assignedUnits.map((a) => a.stockUnitId);
    const unitZone  = Object.fromEntries(assignedUnits.map((a) => [a.stockUnitId, a.position]));
    const units = await db
      .select({ id: stockUnits.id, stockItemId: stockUnits.stockItemId })
      .from(stockUnits)
      .where(inArray(stockUnits.id, unitIds));

    for (const u of units) {
      counts[u.stockItemId] = (counts[u.stockItemId] ?? 0) + 1;
      const p = unitZone[u.id];
      if (p && !zoneByItem[u.stockItemId]) zoneByItem[u.stockItemId] = p;
    }
  }

  const itemIds = Object.keys(counts);
  const itemRows = itemIds.length
    ? await db.select({ id: stockItems.id, name: stockItems.name, category: stockItems.category })
        .from(stockItems).where(inArray(stockItems.id, itemIds))
    : [];
  const itemMap = Object.fromEntries(itemRows.map((i) => [i.id, i]));

  return itemIds.map((id) => ({
    stockItemId: id,
    category:    itemMap[id]?.category ?? "Uncategorized",
    itemName:    itemMap[id]?.name     ?? "Unknown",
    quantity:    counts[id],
    zone:        zoneByItem[id] ?? null,
  }));
}

// GET /api/jobs — ดึงงานทั้งหมด เรียงจากใหม่ไปเก่า
jobsRouter.get("/", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(jobs)
      .where(eq(jobs.companyId, req.companyId))
      .orderBy(desc(jobs.startDate));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch jobs" });
  }
});

// GET /api/jobs/pullsheets — pull sheets ทั้งหมด พร้อม job name + assignee name + item count
// ต้องอยู่ก่อน /:id เพื่อกัน Express จับ "pullsheets" เป็น :id
// ใช้ separate queries แทน JOIN เพื่อหลีกเลี่ยง Drizzle column name conflict (jobs.name vs users.name)
jobsRouter.get("/pullsheets", async (req, res) => {
  try {
    // 1. ดึง pull sheets ทั้งหมดของบริษัท
    const sheets = await db
      .select()
      .from(pullSheets)
      .where(eq(pullSheets.companyId, req.companyId))
      .orderBy(desc(pullSheets.createdAt));

    if (sheets.length === 0) {
      return res.json([]);
    }

    // 2. ดึง job names
    const jobIds = Array.from(new Set(sheets.map((s) => s.jobId).filter(Boolean))) as string[];
    const jobRows = jobIds.length
      ? await db.select({ id: jobs.id, name: jobs.name }).from(jobs).where(inArray(jobs.id, jobIds))
      : [];
    const jobNameMap: Record<string, string> = Object.fromEntries(jobRows.map((j) => [j.id, j.name]));

    // 3. ดึง assignee names
    const assigneeIds = Array.from(new Set(sheets.map((s) => s.assigneeId).filter(Boolean))) as string[];
    const userRows = assigneeIds.length
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, assigneeIds))
      : [];
    const userNameMap: Record<string, string> = Object.fromEntries(userRows.map((u) => [u.id, u.name]));

    // 4. นับ items จาก job_stock + job_units
    const stockCounts: Record<string, number> = {};
    for (const jid of jobIds) {
      const equipment = await getJobEquipment(jid);
      stockCounts[jid] = equipment.reduce((s, e) => s + e.quantity, 0);
    }

    res.json(sheets.map((s) => ({
      id:        s.id,
      status:    s.status.charAt(0).toUpperCase() + s.status.slice(1),
      createdAt: s.createdAt,
      jobId:     s.jobId,
      job:       s.jobId ? (jobNameMap[s.jobId] ?? "—") : "—",
      assignee:  s.assigneeId ? (userNameMap[s.assigneeId] ?? "—") : "—",
      items:     s.jobId ? (stockCounts[s.jobId] ?? 0) : 0,
    })));
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to fetch pull sheets" });
  }
});

// DELETE /api/jobs/pullsheets/:id — ลบ pull sheet
jobsRouter.delete("/pullsheets/:id", async (req, res) => {
  try {
    const [deleted] = await db
      .delete(pullSheets)
      .where(and(eq(pullSheets.id, req.params.id), eq(pullSheets.companyId, req.companyId)))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Pull sheet not found" });
    res.json({ message: "Pull sheet deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete pull sheet" });
  }
});

// GET /api/jobs/crew-matrix — ทุก job_crew rows ของบริษัทนี้ (สำหรับ crew matrix view)
jobsRouter.get("/crew-matrix", async (req, res) => {
  try {
    const rows = await db
      .select({ jobId: jobCrew.jobId, userId: jobCrew.userId })
      .from(jobCrew)
      .innerJoin(jobs, eq(jobs.id, jobCrew.jobId))
      .where(eq(jobs.companyId, req.companyId));
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch crew matrix" });
  }
});

// GET /api/jobs/crew — users + job assignments + tasks (pull sheets) + responsibility log
// ต้องอยู่ก่อน /:id เพื่อกัน Express จับ "crew" เป็น :id
jobsRouter.get("/crew", async (req, res) => {
  try {
    const companyUsers = await db
      .select()
      .from(users)
      .where(eq(users.companyId, req.companyId));

    // crew members พร้อม current/next job
    const crew = await Promise.all(companyUsers.map(async (user) => {
      const assignments = await db
        .select({
          jobId:     jobCrew.jobId,
          jobName:   jobs.name,
          jobStatus: jobs.status,
          startDate: jobs.startDate,
        })
        .from(jobCrew)
        .innerJoin(jobs, eq(jobCrew.jobId, jobs.id))
        .where(eq(jobCrew.userId, user.id))
        .orderBy(jobs.startDate);

      const currentJob = assignments.find((a) => a.jobStatus === "active");
      // นับ job ที่ยังเป็น draft ด้วย เพราะ job ใหม่จะมี status เป็น draft โดย default
      const nextJob    = assignments.find((a) => a.jobStatus === "scheduled" || a.jobStatus === "draft");

      let items = 0;
      if (currentJob) {
        const stock = await db
          .select({ qty: jobStock.quantity })
          .from(jobStock)
          .where(eq(jobStock.jobId, currentJob.jobId));
        items = stock.reduce((s, s2) => s + s2.qty, 0);
      }

      return {
        id:         user.id,
        name:       user.name,
        role:       user.role,
        initials:   user.initials,
        currentJob: currentJob?.jobName ?? "—",
        nextJob:    nextJob?.jobName    ?? "—",
        items,
        tasksToday: 0,
      };
    }));

    // tasks — ดึงจาก pull sheets ที่ยังไม่เสร็จ
    const pendingSheets = await db
      .select({
        id:       pullSheets.id,
        status:   pullSheets.status,
        jobId:    pullSheets.jobId,
        jobName:  jobs.name,
        jobStart: jobs.startDate,
      })
      .from(pullSheets)
      .leftJoin(jobs, eq(pullSheets.jobId, jobs.id))
      .where(eq(pullSheets.companyId, req.companyId));

    const statusToTask: Record<string, string> = {
      draft: "Pending", pending: "In Progress", dispatched: "Done", returned: "Done",
    };

    const tasks = await Promise.all(
      pendingSheets
        .filter((ps) => ps.status !== "returned")
        .map(async (ps) => {
          const stock = ps.jobId
            ? await db.select({ qty: jobStock.quantity }).from(jobStock).where(eq(jobStock.jobId, ps.jobId))
            : [];
          return {
            id:       ps.id,
            title:    `Pull sheet ${ps.id}${ps.jobName ? ` — ${ps.jobName}` : ""}`,
            job:      ps.jobName ?? "—",
            priority: ps.status === "pending" ? "High" : "Medium",
            status:   statusToTask[ps.status] ?? "Pending",
            items:    stock.reduce((s, s2) => s + s2.qty, 0),
            due:      ps.jobStart
              ? new Date(ps.jobStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
              : "—",
          };
        })
    );

    // responsibility log — ดึงจาก activityLog ล่าสุด 10 รายการ (separate query หลีกเลี่ยง column conflict)
    const recentActivity = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.companyId, req.companyId))
      .orderBy(desc(activityLog.createdAt))
      .limit(10);

    const activityUserIds = Array.from(new Set(recentActivity.map((a) => a.userId).filter(Boolean))) as string[];
    const activityUsers = activityUserIds.length
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, activityUserIds))
      : [];
    const activityUserMap: Record<string, string> = Object.fromEntries(activityUsers.map((u) => [u.id, u.name]));

    const responsibilityLog = recentActivity.map((a) => ({
      id:        a.id,
      action:    a.action,
      person:    a.userId ? (activityUserMap[a.userId] ?? "—") : "—",
      items:     a.detail,
      job:       "—",
      time:      new Date(a.createdAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      }),
      signature: true,
    }));

    res.json({ crew, tasks, responsibilityLog });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/jobs/:id — ดึงงานพร้อม stock (พร้อมชื่อ item) และ crew
jobsRouter.get("/:id", async (req, res) => {
  try {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.id, req.params.id),
        eq(jobs.companyId, req.companyId)
      ));

    if (!job) return res.status(404).json({ message: "Job not found" });

    const [rawStock, crew, sheets] = await Promise.all([
      db.select().from(jobStock).where(eq(jobStock.jobId, job.id)),
      db.select().from(jobCrew).where(eq(jobCrew.jobId, job.id)),
      db.select().from(pullSheets).where(eq(pullSheets.jobId, job.id)),
    ]);

    // ดึงชื่อ stock items
    const { stockItems } = await import("@shared/schema");
    const itemIds = rawStock.map((s) => s.stockItemId);
    const itemRows = itemIds.length
      ? await db.select({ id: stockItems.id, name: stockItems.name, category: stockItems.category })
          .from(stockItems).where(inArray(stockItems.id, itemIds))
      : [];
    const itemMap = Object.fromEntries(itemRows.map((i) => [i.id, i]));

    const stock = rawStock.map((s) => ({
      ...s,
      itemName:     itemMap[s.stockItemId]?.name     ?? "Unknown",
      itemCategory: itemMap[s.stockItemId]?.category ?? "",
    }));

    res.json({ ...job, stock, crew, pullSheets: sheets });
  } catch (err: any) {
    res.status(500).json({ message: "Failed to fetch job" });
  }
});

// POST /api/jobs — สร้างงานใหม่
jobsRouter.post("/", async (req, res) => {
  try {
    const data = insertJobSchema.parse({
      ...req.body,
      companyId:     req.companyId,
      rehearsalDate: req.body.rehearsalDate ? new Date(req.body.rehearsalDate) : null,
      startDate:     new Date(req.body.startDate),
      endDate:       new Date(req.body.endDate),
    });

    const [job] = await db.insert(jobs).values(data).returning();

    // งานที่สร้างมาพร้อมสถานะ "scheduled" — สร้างใบเบิกอุปกรณ์ draft ให้อัตโนมัติ
    if (job.status === "scheduled") {
      await ensurePullSheetForJob(job.id, req.companyId, req.userId);
    }

    // ส่งข้อความแจ้งงานใหม่เข้ากลุ่ม LINE (ถ้าตั้งค่าไว้)
    const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, req.userId));
    const lines = [
      `📋 งานใหม่: ${job.name}`,
      `ลูกค้า: ${job.client}`,
      `วันที่: ${job.startDate.toLocaleDateString("th-TH")} - ${job.endDate.toLocaleDateString("th-TH")}`,
    ];
    if (job.location) lines.push(`สถานที่: ${job.location}`);
    lines.push(`สร้างโดย: ${actor?.name ?? "-"}`);
    void sendLineMessage(req.companyId, lines.join("\n"));

    res.status(201).json(job);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/jobs/:id/duplicate — ทำซ้ำงาน (คัดลอกอุปกรณ์ + ทีม + รถ)
// ไม่คัดลอก: incidents / expenses / pull sheets / quotes / invoices / containers
// งานใหม่เป็น draft เสมอ (ไม่ยิง LINE / ไม่สร้าง pull sheet อัตโนมัติ)
jobsRouter.post("/:id/duplicate", async (req, res) => {
  try {
    const [orig] = await db.select().from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)));
    if (!orig) return res.status(404).json({ message: "ไม่พบงานต้นฉบับ" });

    const { name, startDate, endDate } = req.body ?? {};
    const [job] = await db.insert(jobs).values({
      companyId:     req.companyId,
      name:          (typeof name === "string" && name.trim()) ? name.trim() : `${orig.name} (copy)`,
      client:        orig.client,
      location:      orig.location,
      rehearsalDate: orig.rehearsalDate,
      startDate:     startDate ? new Date(startDate) : orig.startDate,
      endDate:       endDate ? new Date(endDate) : orig.endDate,
      status:        "draft",
    }).returning();

    // ดึงข้อมูลที่จะคัดลอกทั้งหมดพร้อมกัน
    const [srcUnits, srcStock, srcCrew, srcVehicles] = await Promise.all([
      db.select().from(jobUnits).where(eq(jobUnits.jobId, orig.id)),
      db.select().from(jobStock).where(eq(jobStock.jobId, orig.id)),
      db.select().from(jobCrew).where(eq(jobCrew.jobId, orig.id)),
      db.select().from(jobVehicles).where(eq(jobVehicles.jobId, orig.id)),
    ]);

    // units → reset phase เป็น planned (ตาม Sync Contract: assign แผนไม่แตะ status)
    if (srcUnits.length)
      await db.insert(jobUnits).values(srcUnits.map((u) => ({ jobId: job.id, stockUnitId: u.stockUnitId, phase: "planned" as const })));
    if (srcStock.length)
      await db.insert(jobStock).values(srcStock.map((s) => ({ jobId: job.id, stockItemId: s.stockItemId, quantity: s.quantity })));
    if (srcCrew.length)
      await db.insert(jobCrew).values(srcCrew.map((c) => ({ jobId: job.id, userId: c.userId, role: c.role })));
    if (srcVehicles.length)
      await db.insert(jobVehicles).values(srcVehicles.map((v) => ({ companyId: req.companyId, jobId: job.id, vehicleType: v.vehicleType, note: v.note })));

    res.status(201).json(job);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/jobs/:id/units — individual units ที่ assign ให้ job
jobsRouter.get("/:id/units", async (req, res) => {
  try {
    const assigned = await db
      .select()
      .from(jobUnits)
      .where(eq(jobUnits.jobId, req.params.id));

    if (assigned.length === 0) return res.json([]);

    const unitIds  = assigned.map((a) => a.stockUnitId);
    const phaseMap = Object.fromEntries(assigned.map((a) => [a.stockUnitId, { phase: a.phase, jobUnitId: a.id, position: a.position }]));
    const units    = await db
      .select()
      .from(stockUnits)
      .where(inArray(stockUnits.id, unitIds));

    const itemIds  = Array.from(new Set(units.map((u) => u.stockItemId)));
    const items    = itemIds.length
      ? await db.select({ id: stockItems.id, name: stockItems.name })
          .from(stockItems).where(inArray(stockItems.id, itemIds))
      : [];
    const itemMap  = Object.fromEntries(items.map((i) => [i.id, i.name]));

    res.json(units.map((u) => ({
      ...u,
      itemName:  itemMap[u.stockItemId] ?? "Unknown",
      phase:     phaseMap[u.id]?.phase ?? "planned",
      jobUnitId: phaseMap[u.id]?.jobUnitId,
      position:  phaseMap[u.id]?.position ?? null,
    })));
  } catch {
    res.status(500).json({ message: "Failed to fetch job units" });
  }
});

// POST /api/jobs/:id/units — set individual units สำหรับ job (replace all)
jobsRouter.post("/:id/units", async (req, res) => {
  try {
    const { unitIds }: { unitIds: string[] } = req.body;
    const newIds = unitIds ?? [];

    // ดึง unit + position ที่อยู่ใน job ปัจจุบันก่อน replace (เพื่อคงโซนไว้ตอน re-save)
    const existing = await db
      .select({ stockUnitId: jobUnits.stockUnitId, position: jobUnits.position })
      .from(jobUnits)
      .where(eq(jobUnits.jobId, req.params.id));
    const posMap = Object.fromEntries(existing.map((r) => [r.stockUnitId, r.position]));

    await db.delete(jobUnits).where(eq(jobUnits.jobId, req.params.id));

    if (newIds.length > 0) {
      await db.insert(jobUnits).values(
        newIds.map((uid) => ({ jobId: req.params.id, stockUnitId: uid, position: posMap[uid] ?? null }))
      );
    }

    // Status is ONLY changed by physical scan (ScanModal). Planning does not touch status.

    res.json({ message: "Units updated" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/jobs/:id/positions — ตั้งโซน (FOH/Mon/Power/Stage) ให้ unit + bulk ในงาน
// units จัดกลุ่มตามโซนแล้ว update ทีเดียวต่อโซน (โซนมีไม่กี่ค่า, unit เยอะ)
jobsRouter.put("/:id/positions", async (req, res) => {
  try {
    const jobId = req.params.id;
    const units: { stockUnitId: string; position: string | null }[] = Array.isArray(req.body?.units) ? req.body.units : [];
    const bulk:  { stockItemId: string; position: string | null }[] = Array.isArray(req.body?.bulk) ? req.body.bulk : [];

    const byPos = new Map<string | null, string[]>();
    for (const u of units) {
      const p = u.position || null;
      if (!byPos.has(p)) byPos.set(p, []);
      byPos.get(p)!.push(u.stockUnitId);
    }
    for (const [p, ids] of Array.from(byPos)) {
      if (ids.length === 0) continue;
      await db.update(jobUnits).set({ position: p })
        .where(and(eq(jobUnits.jobId, jobId), inArray(jobUnits.stockUnitId, ids)));
    }

    // Bulk position now normally flows through POST /:id/stock (one row per position split);
    // this branch is kept for compatibility but the picker no longer sends a `bulk` payload.
    for (const b of bulk) {
      await db.update(jobStock).set({ position: b.position || null })
        .where(and(eq(jobStock.jobId, jobId), eq(jobStock.stockItemId, b.stockItemId)));
    }

    res.json({ message: "Positions updated", units: units.length, bulk: bulk.length });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/jobs/:id/units/phase — อัปเดต phase ให้หลาย units พร้อมกัน
jobsRouter.put("/:id/units/phase", async (req, res) => {
  try {
    const { stockUnitIds, phase } = req.body as { stockUnitIds: string[]; phase: string };
    if (!Array.isArray(stockUnitIds) || stockUnitIds.length === 0 || !phase) {
      return res.status(400).json({ message: "stockUnitIds and phase required" });
    }
    await db
      .update(jobUnits)
      .set({ phase: phase as any })
      .where(and(
        eq(jobUnits.jobId, req.params.id),
        inArray(jobUnits.stockUnitId, stockUnitIds),
      ));
    res.json({ message: "Phase updated", count: stockUnitIds.length });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/jobs/:id/containers — racks/containers ที่ assign ให้ job นี้
jobsRouter.get("/:id/containers", async (req, res) => {
  try {
    const links = await db
      .select()
      .from(jobContainers)
      .where(eq(jobContainers.jobId, req.params.id));

    if (links.length === 0) return res.json([]);

    const containerIds = links.map((l) => l.containerId);
    const conts = await db
      .select()
      .from(containers)
      .where(inArray(containers.id, containerIds));

    const unitLinks = await db
      .select()
      .from(containerUnits)
      .where(inArray(containerUnits.containerId, containerIds));

    const itemCounts: Record<string, number> = {};
    for (const l of unitLinks) {
      itemCounts[l.containerId] = (itemCounts[l.containerId] ?? 0) + 1;
    }

    res.json(conts.map((c) => ({ ...c, itemCount: itemCounts[c.id] ?? 0 })));
  } catch {
    res.status(500).json({ message: "Failed to fetch job containers" });
  }
});

// POST /api/jobs/:id/containers — เพิ่ม rack/container เข้า job (ดึง units ที่อยู่ในแร็คเข้า job_units ด้วย)
jobsRouter.post("/:id/containers", async (req, res) => {
  try {
    const { containerId }: { containerId: string } = req.body;
    if (!containerId) return res.status(400).json({ message: "containerId is required" });

    // container ออกได้กับ job เดียวในเวลาเดียวกัน — ลบการผูกเดิม (ถ้ามี) ก่อน
    await db.delete(jobContainers).where(eq(jobContainers.containerId, containerId));
    await db.insert(jobContainers).values({ jobId: req.params.id, containerId });
    await db.update(containers).set({ isOut: true }).where(eq(containers.id, containerId));

    // ดึงของทั้งหมดที่อยู่ในแร็คตอนนี้ เข้า job_units (ไม่ซ้ำของที่ assign อยู่แล้ว)
    const unitLinks = await db
      .select()
      .from(containerUnits)
      .where(eq(containerUnits.containerId, containerId));

    if (unitLinks.length > 0) {
      const unitIds = unitLinks.map((l) => l.stockUnitId);
      const existing = await db
        .select()
        .from(jobUnits)
        .where(and(eq(jobUnits.jobId, req.params.id), inArray(jobUnits.stockUnitId, unitIds)));

      const existingIds = new Set(existing.map((e) => e.stockUnitId));
      const newIds = unitIds.filter((id) => !existingIds.has(id));

      if (newIds.length > 0) {
        await db.insert(jobUnits).values(newIds.map((stockUnitId) => ({ jobId: req.params.id, stockUnitId })));
      }

      // Status changed only by physical scan, not by container assignment
    }

    res.status(201).json({ message: "Container assigned" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/jobs/:id/apply-set/:setId — เพิ่มชุดอุปกรณ์เข้างานทั้งชุด (merge, ไม่ replace)
// pinned unit → ใช้ตัวนั้น; auto unit → เลือก unit ว่างตามจำนวน; bulk → upsert job_stock
// ไม่แตะ stock_units.status (เคารพ Sync Contract) — คืน shortfall เมื่อของไม่พอ
jobsRouter.post("/:id/apply-set/:setId", async (req, res) => {
  try {
    const jobId = req.params.id;

    const [job] = await db.select().from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, req.companyId)));
    if (!job) return res.status(404).json({ message: "ไม่พบงาน" });

    const [set] = await db.select().from(equipmentSets)
      .where(and(eq(equipmentSets.id, req.params.setId), eq(equipmentSets.companyId, req.companyId)));
    if (!set) return res.status(404).json({ message: "ไม่พบชุดอุปกรณ์" });

    const setItems = await db.select().from(equipmentSetItems).where(eq(equipmentSetItems.setId, set.id));
    if (setItems.length === 0) return res.status(201).json({ message: "ชุดว่าง", shortfall: [], addedUnits: [], addedBulkItems: [] });

    // trackingMode ต่อ item
    const itemIds = Array.from(new Set(setItems.map((i) => i.stockItemId)));
    const modes = await db.select({ id: stockItems.id, trackingMode: stockItems.trackingMode })
      .from(stockItems).where(inArray(stockItems.id, itemIds));
    const modeMap = Object.fromEntries(modes.map((m) => [m.id, m.trackingMode]));

    // unit ที่อยู่ในงานนี้อยู่แล้ว (กันซ้ำ)
    const existingUnits = await db.select({ stockUnitId: jobUnits.stockUnitId })
      .from(jobUnits).where(eq(jobUnits.jobId, jobId));
    const claimed = new Set(existingUnits.map((u) => u.stockUnitId));

    // bulk ที่อยู่ในงานนี้อยู่แล้ว (สำหรับ upsert)
    const existingBulk = await db.select().from(jobStock).where(eq(jobStock.jobId, jobId));

    const unitRows: { jobId: string; stockUnitId: string; phase: "planned" }[] = [];
    const bulkInserts: { jobId: string; stockItemId: string; quantity: number }[] = [];
    const bulkUpdates: { id: string; quantity: number }[] = [];
    const shortfall: { stockItemId: string; wanted: number; got: number }[] = [];
    // ติดตาม unit/bulk ที่เพิ่งเพิ่มเข้าไปจริงในการเรียกครั้งนี้ (สำหรับ client ไปติดโซนต่อ)
    const addedUnits: { unitId: string; stockItemId: string }[] = [];
    const addedBulkItems: { stockItemId: string; quantity: number }[] = [];

    for (const it of setItems) {
      if (it.unitId) {
        // ปักหมุด unit เฉพาะ — ต้องว่างและยังไม่อยู่ในงาน
        if (claimed.has(it.unitId)) continue; // อยู่ในงานแล้ว ถือว่าได้
        const [u] = await db.select({ id: stockUnits.id, status: stockUnits.status })
          .from(stockUnits)
          .where(and(eq(stockUnits.id, it.unitId), eq(stockUnits.companyId, req.companyId)));
        if (u && u.status === "available") {
          unitRows.push({ jobId, stockUnitId: u.id, phase: "planned" });
          addedUnits.push({ unitId: u.id, stockItemId: it.stockItemId });
          claimed.add(u.id);
        } else {
          shortfall.push({ stockItemId: it.stockItemId, wanted: 1, got: 0 });
        }
      } else if (modeMap[it.stockItemId] === "bulk") {
        // bulk — upsert job_stock (บวกเพิ่ม qty หรือ insert แถวใหม่)
        const existing = existingBulk.find((b) => b.stockItemId === it.stockItemId && !b.position);
        if (existing) {
          bulkUpdates.push({ id: existing.id, quantity: existing.quantity + it.quantity });
        } else {
          bulkInserts.push({ jobId, stockItemId: it.stockItemId, quantity: it.quantity });
        }
        addedBulkItems.push({ stockItemId: it.stockItemId, quantity: it.quantity });
      } else {
        // auto unit — เลือก unit ว่างตามจำนวน ที่ยังไม่ถูกจองในงานนี้
        const avail = await db.select({ id: stockUnits.id }).from(stockUnits)
          .where(and(
            eq(stockUnits.companyId, req.companyId),
            eq(stockUnits.stockItemId, it.stockItemId),
            eq(stockUnits.status, "available"),
          ));
        const pickable = avail.map((a) => a.id).filter((id) => !claimed.has(id)).slice(0, it.quantity);
        for (const id of pickable) {
          unitRows.push({ jobId, stockUnitId: id, phase: "planned" });
          addedUnits.push({ unitId: id, stockItemId: it.stockItemId });
          claimed.add(id);
        }
        if (pickable.length < it.quantity)
          shortfall.push({ stockItemId: it.stockItemId, wanted: it.quantity, got: pickable.length });
      }
    }

    if (unitRows.length) await db.insert(jobUnits).values(unitRows);
    if (bulkInserts.length) await db.insert(jobStock).values(bulkInserts);
    for (const u of bulkUpdates) await db.update(jobStock).set({ quantity: u.quantity }).where(eq(jobStock.id, u.id));

    res.status(201).json({ message: "เพิ่มชุดอุปกรณ์เข้างานแล้ว", shortfall, addedUnits, addedBulkItems });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/jobs/:id/containers/:containerId — check rack กลับเข้าคลัง
jobsRouter.delete("/:id/containers/:containerId", async (req, res) => {
  try {
    await db
      .delete(jobContainers)
      .where(and(eq(jobContainers.jobId, req.params.id), eq(jobContainers.containerId, req.params.containerId)));

    await db.update(containers).set({ isOut: false }).where(eq(containers.id, req.params.containerId));

    // Remove container units from job_units manifest; status unchanged (scan-driven only)
    const unitLinks = await db
      .select({ stockUnitId: containerUnits.stockUnitId })
      .from(containerUnits)
      .where(eq(containerUnits.containerId, req.params.containerId));
    const unitIds = unitLinks.map((l) => l.stockUnitId);
    if (unitIds.length) {
      await db.delete(jobUnits).where(
        and(eq(jobUnits.jobId, req.params.id), inArray(jobUnits.stockUnitId, unitIds))
      );
    }

    res.json({ message: "Container removed from job" });
  } catch {
    res.status(500).json({ message: "Failed to remove container from job" });
  }
});

// POST /api/jobs/:id/containers/:containerId/load — Load-out: mark rack units as dispatched+out
jobsRouter.post("/:id/containers/:containerId/load", async (req, res) => {
  try {
    // ตรวจสอบว่า job อยู่ในบริษัทนี้
    const [job] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)));
    if (!job) return res.status(404).json({ message: "Job not found" });

    // ดึง units ทั้งหมดในแร็คนี้
    const unitLinks = await db
      .select({ stockUnitId: containerUnits.stockUnitId })
      .from(containerUnits)
      .where(eq(containerUnits.containerId, req.params.containerId));

    if (unitLinks.length === 0) return res.json({ loaded: 0, skipped: 0 });

    const rackUnitIds = unitLinks.map((l) => l.stockUnitId);

    // กรองเฉพาะที่อยู่ใน job_units ของ job นี้
    const jobUnitRows = await db
      .select({ stockUnitId: jobUnits.stockUnitId })
      .from(jobUnits)
      .where(and(eq(jobUnits.jobId, req.params.id), inArray(jobUnits.stockUnitId, rackUnitIds)));

    const matchingUnitIds = jobUnitRows.map((r) => r.stockUnitId);
    const skipped = rackUnitIds.length - matchingUnitIds.length;

    if (matchingUnitIds.length > 0) {
      // เลื่อน phase → dispatched
      await db
        .update(jobUnits)
        .set({ phase: "dispatched" })
        .where(and(eq(jobUnits.jobId, req.params.id), inArray(jobUnits.stockUnitId, matchingUnitIds)));

      // sync stock unit status → out
      await setUnitsOut(matchingUnitIds);
    }

    res.json({ loaded: matchingUnitIds.length, skipped });
  } catch {
    res.status(500).json({ message: "Failed to load container" });
  }
});

// คำนวณ initials จากชื่อ (2 ตัวอักษรแรกของคำแรก 2 คำ)
function crewInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// GET /api/jobs/:id/crew — ทีมงานที่ assign ให้ job นี้ (จาก crew_members roster)
jobsRouter.get("/:id/crew", async (req, res) => {
  try {
    const assigned = await db
      .select()
      .from(jobCrewMembers)
      .where(eq(jobCrewMembers.jobId, req.params.id));

    if (assigned.length === 0) return res.json([]);

    const ids = assigned.map((a) => a.crewMemberId);
    const memberRows = await db
      .select({ id: crewMembers.id, name: crewMembers.name, type: crewMembers.type, role: crewMembers.role, userId: crewMembers.userId })
      .from(crewMembers)
      .where(inArray(crewMembers.id, ids));
    const memberMap = Object.fromEntries(memberRows.map((m) => [m.id, m]));

    res.json(assigned.map((a) => {
      const m = memberMap[a.crewMemberId];
      return {
        crewMemberId: a.crewMemberId,
        name:     m?.name ?? "Unknown",
        type:     m?.type ?? "own_crew",
        role:     a.role ?? m?.role ?? null,
        initials: crewInitials(m?.name ?? "?"),
        hasAccount: !!m?.userId,
      };
    }));
  } catch {
    res.status(500).json({ message: "Failed to fetch job crew" });
  }
});

// POST /api/jobs/:id/crew — assign ทีมงาน (crew_member) เข้า job; own-crew ที่มี account ได้ notification
jobsRouter.post("/:id/crew", async (req, res) => {
  try {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)));

    if (!job) return res.status(404).json({ message: "Job not found" });

    const { crewMemberId, role }: { crewMemberId: string; role?: string } = req.body;
    if (!crewMemberId) return res.status(400).json({ message: "crewMemberId is required" });

    // ต้องเป็นทีมงานของบริษัทนี้
    const [member] = await db
      .select({ id: crewMembers.id, userId: crewMembers.userId })
      .from(crewMembers)
      .where(and(eq(crewMembers.id, crewMemberId), eq(crewMembers.companyId, req.companyId)));
    if (!member) return res.status(404).json({ message: "ไม่พบทีมงาน" });

    const existing = await db
      .select()
      .from(jobCrewMembers)
      .where(and(eq(jobCrewMembers.jobId, req.params.id), eq(jobCrewMembers.crewMemberId, crewMemberId)));

    if (existing.length > 0) return res.status(409).json({ message: "ทีมงานคนนี้ถูก assign เข้างานนี้แล้ว" });

    const [row] = await db.insert(jobCrewMembers)
      .values({ jobId: req.params.id, crewMemberId, role: role ?? null })
      .returning();

    // แจ้งเตือนเฉพาะ own-crew ที่ผูก user account
    if (member.userId) {
      await notify({
        companyId: req.companyId,
        userIds: [member.userId],
        actorId: req.userId,
        type: "job_assigned",
        meta: { jobName: job.name },
        link: "Jobs",
      });
    }

    res.status(201).json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/jobs/:id/crew/:crewMemberId — เอาทีมงานออกจาก job
jobsRouter.delete("/:id/crew/:crewMemberId", async (req, res) => {
  try {
    const [job] = await db
      .select({ name: jobs.name })
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)));

    await db
      .delete(jobCrewMembers)
      .where(and(eq(jobCrewMembers.jobId, req.params.id), eq(jobCrewMembers.crewMemberId, req.params.crewMemberId)));

    const [member] = await db
      .select({ userId: crewMembers.userId })
      .from(crewMembers)
      .where(eq(crewMembers.id, req.params.crewMemberId));

    if (job && member?.userId) {
      await notify({
        companyId: req.companyId,
        userIds: [member.userId],
        actorId: req.userId,
        type: "job_removed",
        meta: { jobName: job.name },
        link: "Jobs",
      });
    }

    res.json({ message: "Crew member removed from job" });
  } catch {
    res.status(500).json({ message: "Failed to remove crew member from job" });
  }
});

// PUT /api/jobs/:id/crew/:crewMemberId — แก้ตำแหน่งเฉพาะงานนี้ (per-job role)
jobsRouter.put("/:id/crew/:crewMemberId", async (req, res) => {
  try {
    const { role } = req.body ?? {};
    const [row] = await db.update(jobCrewMembers)
      .set({ role: role?.trim() || null })
      .where(and(eq(jobCrewMembers.jobId, req.params.id), eq(jobCrewMembers.crewMemberId, req.params.crewMemberId)))
      .returning();
    if (!row) return res.status(404).json({ message: "ไม่พบการมอบหมาย" });
    res.json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/jobs/:id/crew-counts — จำนวนคนแบบเหมา (outsource/loader) ต่องาน
jobsRouter.get("/:id/crew-counts", async (req, res) => {
  try {
    const rows = await db.select({ type: jobCrewCounts.type, count: jobCrewCounts.count })
      .from(jobCrewCounts).where(eq(jobCrewCounts.jobId, req.params.id));
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch crew counts" });
  }
});

// PUT /api/jobs/:id/crew-counts — ตั้งจำนวนของประเภทหนึ่ง (upsert; count<=0 = ลบ)
jobsRouter.put("/:id/crew-counts", async (req, res) => {
  try {
    const { type, count } = req.body ?? {};
    if (!type) return res.status(400).json({ message: "type is required" });
    const n = Math.max(0, Number(count) || 0);
    const [existing] = await db.select().from(jobCrewCounts)
      .where(and(eq(jobCrewCounts.jobId, req.params.id), eq(jobCrewCounts.type, type)));
    if (n === 0) {
      if (existing) await db.delete(jobCrewCounts).where(eq(jobCrewCounts.id, existing.id));
    } else if (existing) {
      await db.update(jobCrewCounts).set({ count: n }).where(eq(jobCrewCounts.id, existing.id));
    } else {
      await db.insert(jobCrewCounts).values({ jobId: req.params.id, type, count: n });
    }
    res.json({ type, count: n });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/jobs/:id/stock — bulk item quantities assigned to this job
jobsRouter.get("/:id/stock", async (req, res) => {
  try {
    const rows = await db.select().from(jobStock).where(eq(jobStock.jobId, req.params.id));
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch job stock" });
  }
});

// POST /api/jobs/:id/stock — batch set stock items สำหรับ job (replace all)
// รับ position ต่อบรรทัดตรงๆ จาก client (รองรับหลายแถวของ stockItemId เดียวกัน คนละโซน)
jobsRouter.post("/:id/stock", async (req, res) => {
  try {
    const { items }: { items: { stockItemId: string; quantity: number; position?: string | null }[] } = req.body;

    await db.delete(jobStock).where(eq(jobStock.jobId, req.params.id));

    if (items && items.length > 0) {
      await db.insert(jobStock).values(
        items.map((item) => ({
          jobId:       req.params.id,
          stockItemId: item.stockItemId,
          quantity:    item.quantity,
          position:    item.position ?? null,
        }))
      );
    }

    res.json({ message: "Stock updated" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/jobs/:id/pullsheets — สร้าง pull sheet ใหม่สำหรับ job
jobsRouter.post("/:id/pullsheets", async (req, res) => {
  try {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)));

    if (!job) return res.status(404).json({ message: "Job not found" });

    const data = insertPullSheetSchema.parse({
      jobId: req.params.id,
      assigneeId: req.body.assigneeId || null,
    });

    const [sheet] = await db
      .insert(pullSheets)
      .values({
        ...data,
        companyId: req.companyId,
        createdById: req.userId,
        status: "draft",
      })
      .returning();

    if (sheet.assigneeId) {
      await notify({
        companyId: req.companyId,
        userIds: [sheet.assigneeId],
        actorId: req.userId,
        type: "pullsheet_assigned",
        meta: { jobName: job.name },
        link: "Jobs",
      });
    }

    res.status(201).json(sheet);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/jobs/:id/pullsheet/pdf — generate ใบเบิกอุปกรณ์เป็น PDF (สร้างใหม่ทุกครั้ง สะท้อนข้อมูลล่าสุด)
jobsRouter.get("/:id/pullsheet/pdf", async (req, res) => {
  try {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)));

    if (!job) return res.status(404).json({ message: "Job not found" });

    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, req.companyId));

    const equipment = await getJobEquipment(job.id);
    const items = equipment.map(({ category, itemName, quantity, zone }) => ({ category, itemName, quantity, zone }));

    const doc = generatePullSheetPdf({ companyName: company?.name ?? "Company", job, items });

    const safeName = job.name.replace(/[^a-z0-9-_]+/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="pullsheet-${safeName}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to generate pull sheet PDF" });
  }
});

// GET /api/jobs/:id/packing-sheet/pdf — Packing Sheet PDF เฉพาะแร็คที่อยู่ใน job นี้
jobsRouter.get("/:id/packing-sheet/pdf", async (req, res) => {
  try {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)));
    if (!job) return res.status(404).json({ message: "Job not found" });

    const [company] = await db
      .select({ name: companies.name })
      .from(companies)
      .where(eq(companies.id, req.companyId));

    // ดึง containers ที่อยู่ใน job นี้
    const jobContainerLinks = await db
      .select({ containerId: jobContainers.containerId })
      .from(jobContainers)
      .where(eq(jobContainers.jobId, req.params.id));

    const containerIds = jobContainerLinks.map((l) => l.containerId);

    const result = containerIds.length
      ? await db.select().from(containers).where(inArray(containers.id, containerIds))
      : [];

    const links = containerIds.length
      ? await db.select().from(containerUnits).where(inArray(containerUnits.containerId, containerIds))
      : [];

    const unitIds = Array.from(new Set(links.map((l) => l.stockUnitId)));
    const units = unitIds.length
      ? await db.select().from(stockUnits).where(inArray(stockUnits.id, unitIds))
      : [];

    const itemIds = Array.from(new Set(units.map((u) => u.stockItemId)));
    const items = itemIds.length
      ? await db.select({ id: stockItems.id, name: stockItems.name, category: stockItems.category })
          .from(stockItems).where(inArray(stockItems.id, itemIds))
      : [];

    const unitMap = Object.fromEntries(units.map((u) => [u.id, u]));
    const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

    const containersWithItems = result.map((c) => ({
      ...c,
      items: links
        .filter((l) => l.containerId === c.id)
        .map((l) => unitMap[l.stockUnitId])
        .filter(Boolean)
        .map((u) => ({
          ...u,
          itemName: itemMap[u.stockItemId]?.name ?? "Unknown",
          category: itemMap[u.stockItemId]?.category ?? "Uncategorized",
        })),
    }));

    const doc = generatePackingSheetPdf({
      companyName: company?.name ?? "Company",
      containers: containersWithItems,
      jobName: job.name,
    });

    const safeName = job.name.replace(/[^a-z0-9-_]+/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="packing-sheet-${safeName}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to generate packing sheet PDF" });
  }
});

// PUT /api/jobs/:id — อัปเดตงาน (เช่น เปลี่ยน status)
jobsRouter.put("/:id", async (req, res) => {
  try {
    const [before] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)));

    if (!before) return res.status(404).json({ message: "Job not found" });

    const [job] = await db
      .update(jobs)
      .set(req.body)
      .where(and(
        eq(jobs.id, req.params.id),
        eq(jobs.companyId, req.companyId)
      ))
      .returning();

    // แจ้งเตือนทีมงานที่ถูก assign ถ้าสถานะหรือกำหนดการของงานเปลี่ยน
    const statusChanged = req.body.status !== undefined && job.status !== before.status;

    // งานเข้าสถานะ "scheduled" — สร้างใบเบิกอุปกรณ์ draft ให้อัตโนมัติ (ถ้ายังไม่มี)
    if (statusChanged && job.status === "scheduled") {
      await ensurePullSheetForJob(job.id, req.companyId, req.userId);
    }

    const dateChanged =
      (req.body.startDate !== undefined && new Date(job.startDate).getTime() !== new Date(before.startDate).getTime()) ||
      (req.body.endDate !== undefined && new Date(job.endDate).getTime() !== new Date(before.endDate).getTime());

    if (statusChanged || dateChanged) {
      const crewRows = await db.select({ userId: jobCrew.userId }).from(jobCrew).where(eq(jobCrew.jobId, job.id));

      if (crewRows.length > 0) {
        await notify({
          companyId: req.companyId,
          userIds: crewRows.map((c) => c.userId),
          actorId: req.userId,
          type: "job_updated",
          meta: { jobName: job.name, status: job.status },
          link: "Jobs",
        });
      }
    }

    res.json(job);
  } catch {
    res.status(500).json({ message: "Failed to update job" });
  }
});

// DELETE /api/jobs/:id — ลบงาน (Admin/Manager เท่านั้น)
// job_stock, job_crew, job_units, job_containers, pull_sheets จะถูกลบตามไปด้วย (cascade)
// quotes, invoices, incidents, sub_rentals จะยังคงอยู่แต่ตัดการเชื่อมโยง (jobId = null)
jobsRouter.delete("/:id", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }

  try {
    // Reset containers.isOut before cascade deletes job_containers rows
    const assignedContainers = await db
      .select({ containerId: jobContainers.containerId })
      .from(jobContainers)
      .where(eq(jobContainers.jobId, req.params.id));
    if (assignedContainers.length > 0) {
      await db
        .update(containers)
        .set({ isOut: false })
        .where(inArray(containers.id, assignedContainers.map((c) => c.containerId)));
    }

    // Reset any units that were physically scanned out (status='out') back to available
    const assignedUnits = await db
      .select({ stockUnitId: jobUnits.stockUnitId })
      .from(jobUnits)
      .where(eq(jobUnits.jobId, req.params.id));
    await setUnitsAvailable(assignedUnits.map((r) => r.stockUnitId));

    const [deleted] = await db
      .delete(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Job not found" });
    res.json({ message: "Job deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to delete job" });
  }
});

// GET /api/jobs/all/incidents — ดึง incident reports ทั้งหมด
jobsRouter.get("/all/incidents", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(incidents)
      .where(eq(incidents.companyId, req.companyId))
      .orderBy(desc(incidents.date));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch incidents" });
  }
});

// POST /api/jobs/:id/incidents — รายงาน incident ใหม่
jobsRouter.post("/:id/incidents", async (req, res) => {
  try {
    const [incident] = await db
      .insert(incidents)
      .values({
        ...req.body,
        jobId:     req.params.id,
        companyId: req.companyId,
      })
      .returning();

    if (incident.stockUnitId) await recalculateUnitHealth(incident.stockUnitId);

    res.status(201).json(incident);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/jobs/incidents/:incidentId — ปิด incident เป็น resolved (Admin/Manager เท่านั้น)
jobsRouter.put("/incidents/:incidentId", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }

  try {
    const [incident] = await db
      .update(incidents)
      .set({ status: "resolved" })
      .where(and(eq(incidents.id, req.params.incidentId), eq(incidents.companyId, req.companyId)))
      .returning();

    if (!incident) return res.status(404).json({ message: "Incident not found" });

    if (incident.stockUnitId) await recalculateUnitHealth(incident.stockUnitId);

    res.json(incident);
  } catch (err: any) {
    res.status(500).json({ message: err?.message ?? "Failed to resolve incident" });
  }
});

// ─── Job Expenses (ค่าเด็กโหลด / ค่าเดินทาง-ส่งของ พร้อมสลิป) ──────

// GET /api/jobs/:id/expenses
jobsRouter.get("/:id/expenses", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(jobExpenses)
      .where(and(eq(jobExpenses.jobId, req.params.id), eq(jobExpenses.companyId, req.companyId)))
      .orderBy(desc(jobExpenses.createdAt));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch job expenses" });
  }
});

// POST /api/jobs/:id/expenses — เพิ่มรายการค่าใช้จ่าย (Admin/Manager เท่านั้น)
jobsRouter.post("/:id/expenses", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }

  try {
    const data = insertJobExpenseSchema.parse({
      ...req.body,
      jobId:     req.params.id,
      companyId: req.companyId,
    });

    const [expense] = await db.insert(jobExpenses).values(data).returning();
    res.status(201).json(expense);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/jobs/expenses/:expenseId — ลบรายการค่าใช้จ่าย (Admin/Manager เท่านั้น)
jobsRouter.delete("/expenses/:expenseId", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }

  try {
    const [deleted] = await db
      .delete(jobExpenses)
      .where(and(eq(jobExpenses.id, req.params.expenseId), eq(jobExpenses.companyId, req.companyId)))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Expense not found" });
    res.json({ message: "Expense deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete expense" });
  }
});

// ─── Job Vehicles (รถที่ใช้ในงาน — logistics เท่านั้น ไม่ผูกกับต้นทุน) ──────

// GET /api/jobs/:id/vehicles — รถที่ใช้ในงาน (join คลังรถ + คนขับ)
jobsRouter.get("/:id/vehicles", async (req, res) => {
  try {
    const driver = alias(crewMembers, "driver");
    const result = await db
      .select({
        id:                 jobVehicles.id,
        jobId:              jobVehicles.jobId,
        vehicleType:        jobVehicles.vehicleType,
        vehicleId:          jobVehicles.vehicleId,
        driverCrewMemberId: jobVehicles.driverCrewMemberId,
        note:               jobVehicles.note,
        createdAt:          jobVehicles.createdAt,
        plate:              vehicles.plate,
        driverName:         driver.name,
      })
      .from(jobVehicles)
      .leftJoin(vehicles, eq(jobVehicles.vehicleId, vehicles.id))
      .leftJoin(driver, eq(jobVehicles.driverCrewMemberId, driver.id))
      .where(and(eq(jobVehicles.jobId, req.params.id), eq(jobVehicles.companyId, req.companyId)))
      .orderBy(desc(jobVehicles.createdAt));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch job vehicles" });
  }
});

// POST /api/jobs/:id/vehicles — เพิ่มรถ (จากคลัง vehicleId หรือ ad-hoc vehicleType) + คนขับ (optional)
jobsRouter.post("/:id/vehicles", async (req, res) => {
  try {
    const { vehicleId, driverCrewMemberId, note } = req.body ?? {};
    let vehicleType: string | undefined = req.body?.vehicleType?.trim() || undefined;

    if (vehicleId) {
      const [v] = await db.select({ name: vehicles.name })
        .from(vehicles)
        .where(and(eq(vehicles.id, vehicleId), eq(vehicles.companyId, req.companyId)));
      if (!v) return res.status(404).json({ message: "ไม่พบรถในคลัง" });
      if (!vehicleType) vehicleType = v.name;   // ใช้ชื่อรถจากคลังเป็น label
    }
    if (!vehicleType) return res.status(400).json({ message: "ต้องระบุรถ (เลือกจากคลัง หรือพิมพ์ประเภทรถ)" });

    const data = insertJobVehicleSchema.parse({
      jobId:              req.params.id,
      companyId:          req.companyId,
      vehicleType,
      vehicleId:          vehicleId ?? null,
      driverCrewMemberId: driverCrewMemberId ?? null,
      note:               note ?? null,
    });

    const [vehicle] = await db.insert(jobVehicles).values(data).returning();
    res.status(201).json(vehicle);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/jobs/vehicles/:vehicleId — แก้คนขับ / หมายเหตุ ของรถในงาน
jobsRouter.put("/vehicles/:vehicleId", async (req, res) => {
  try {
    const { driverCrewMemberId, note } = req.body ?? {};
    const [row] = await db.update(jobVehicles)
      .set({
        ...(driverCrewMemberId !== undefined ? { driverCrewMemberId: driverCrewMemberId || null } : {}),
        ...(note !== undefined ? { note: note || null } : {}),
      })
      .where(and(eq(jobVehicles.id, req.params.vehicleId), eq(jobVehicles.companyId, req.companyId)))
      .returning();
    if (!row) return res.status(404).json({ message: "Vehicle not found" });
    res.json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/jobs/vehicles/:vehicleId
jobsRouter.delete("/vehicles/:vehicleId", async (req, res) => {
  try {
    const [deleted] = await db
      .delete(jobVehicles)
      .where(and(eq(jobVehicles.id, req.params.vehicleId), eq(jobVehicles.companyId, req.companyId)))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Vehicle not found" });
    res.json({ message: "Vehicle deleted" });
  } catch {
    res.status(500).json({ message: "Failed to remove vehicle" });
  }
});

// GET /api/jobs/:id/subrentals — ของที่เช่าจากภายนอกสำหรับงานนี้
jobsRouter.get("/:id/subrentals", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(subRentals)
      .where(and(eq(subRentals.jobId, req.params.id), eq(subRentals.companyId, req.companyId)))
      .orderBy(desc(subRentals.dueBack));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch job sub-rentals" });
  }
});

// POST /api/jobs/:id/subrentals — เพิ่มรายการเช่าจากภายนอก (Admin/Manager เท่านั้น)
jobsRouter.post("/:id/subrentals", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }

  try {
    const data = insertSubRentalSchema.parse({
      ...req.body,
      dueBack:   new Date(req.body.dueBack),
      jobId:     req.params.id,
      companyId: req.companyId,
    });

    const [rental] = await db.insert(subRentals).values(data).returning();
    res.status(201).json(rental);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/jobs/subrentals/:subRentalId — ลบรายการเช่าจากภายนอก (Admin/Manager เท่านั้น)
jobsRouter.delete("/subrentals/:subRentalId", async (req, res) => {
  if (req.userRole !== "admin" && req.userRole !== "manager") {
    return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
  }

  try {
    const [deleted] = await db
      .delete(subRentals)
      .where(and(eq(subRentals.id, req.params.subRentalId), eq(subRentals.companyId, req.companyId)))
      .returning();

    if (!deleted) return res.status(404).json({ message: "Sub-rental not found" });
    res.json({ message: "Sub-rental deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete sub-rental" });
  }
});
