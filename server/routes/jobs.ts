import { Router } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  jobs, jobStock, jobCrew, jobUnits, jobContainers, pullSheets, incidents, insertJobSchema,
  insertPullSheetSchema, insertJobCrewSchema, users, activityLog, stockUnits, stockItems, containers, containerUnits, companies,
  jobExpenses, insertJobExpenseSchema, jobVehicles, insertJobVehicleSchema,
} from "@shared/schema";
import { generatePullSheetPdf } from "../lib/pullsheetPdf";
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
  for (const s of rawStock) {
    counts[s.stockItemId] = (counts[s.stockItemId] ?? 0) + s.quantity;
  }

  if (assignedUnits.length > 0) {
    const unitIds = assignedUnits.map((a) => a.stockUnitId);
    const units = await db
      .select({ id: stockUnits.id, stockItemId: stockUnits.stockItemId })
      .from(stockUnits)
      .where(inArray(stockUnits.id, unitIds));

    for (const u of units) {
      counts[u.stockItemId] = (counts[u.stockItemId] ?? 0) + 1;
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

// GET /api/jobs/:id/units — individual units ที่ assign ให้ job
jobsRouter.get("/:id/units", async (req, res) => {
  try {
    const assigned = await db
      .select()
      .from(jobUnits)
      .where(eq(jobUnits.jobId, req.params.id));

    if (assigned.length === 0) return res.json([]);

    const unitIds = assigned.map((a) => a.stockUnitId);
    const units   = await db
      .select()
      .from(stockUnits)
      .where(inArray(stockUnits.id, unitIds));

    const itemIds  = Array.from(new Set(units.map((u) => u.stockItemId)));
    const items    = itemIds.length
      ? await db.select({ id: stockItems.id, name: stockItems.name })
          .from(stockItems).where(inArray(stockItems.id, itemIds))
      : [];
    const itemMap  = Object.fromEntries(items.map((i) => [i.id, i.name]));

    res.json(units.map((u) => ({ ...u, itemName: itemMap[u.stockItemId] ?? "Unknown" })));
  } catch {
    res.status(500).json({ message: "Failed to fetch job units" });
  }
});

// POST /api/jobs/:id/units — set individual units สำหรับ job (replace all)
jobsRouter.post("/:id/units", async (req, res) => {
  try {
    const { unitIds }: { unitIds: string[] } = req.body;

    await db.delete(jobUnits).where(eq(jobUnits.jobId, req.params.id));

    if (unitIds && unitIds.length > 0) {
      await db.insert(jobUnits).values(
        unitIds.map((uid) => ({ jobId: req.params.id, stockUnitId: uid }))
      );
    }

    res.json({ message: "Units updated" });
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

      // ของในแร็คนี้ออกงานแล้ว — sync สถานะ
      await setUnitsOut(unitIds);
    }

    res.status(201).json({ message: "Container assigned" });
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

    // ของในแร็คนี้กลับเข้าคลังแล้ว — sync สถานะ
    const unitLinks = await db
      .select({ stockUnitId: containerUnits.stockUnitId })
      .from(containerUnits)
      .where(eq(containerUnits.containerId, req.params.containerId));
    await setUnitsAvailable(unitLinks.map((l) => l.stockUnitId));

    res.json({ message: "Container removed from job" });
  } catch {
    res.status(500).json({ message: "Failed to remove container from job" });
  }
});

// GET /api/jobs/:id/crew — ทีมงานที่ assign ให้ job นี้
jobsRouter.get("/:id/crew", async (req, res) => {
  try {
    const assigned = await db
      .select()
      .from(jobCrew)
      .where(eq(jobCrew.jobId, req.params.id));

    if (assigned.length === 0) return res.json([]);

    const userIds = assigned.map((a) => a.userId);
    const userRows = await db
      .select({ id: users.id, name: users.name, initials: users.initials, role: users.role })
      .from(users)
      .where(inArray(users.id, userIds));
    const userMap = Object.fromEntries(userRows.map((u) => [u.id, u]));

    res.json(assigned.map((a) => ({
      userId:   a.userId,
      name:     userMap[a.userId]?.name     ?? "Unknown",
      initials: userMap[a.userId]?.initials ?? "?",
      role:     userMap[a.userId]?.role     ?? "crew",
    })));
  } catch {
    res.status(500).json({ message: "Failed to fetch job crew" });
  }
});

// POST /api/jobs/:id/crew — assign ทีมงานคนหนึ่งเข้า job
jobsRouter.post("/:id/crew", async (req, res) => {
  try {
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)));

    if (!job) return res.status(404).json({ message: "Job not found" });

    const { userId }: { userId: string } = req.body;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const existing = await db
      .select()
      .from(jobCrew)
      .where(and(eq(jobCrew.jobId, req.params.id), eq(jobCrew.userId, userId)));

    if (existing.length > 0) return res.status(409).json({ message: "User already assigned to this job" });

    const data = insertJobCrewSchema.parse({ jobId: req.params.id, userId, role: null });
    const [row] = await db.insert(jobCrew).values(data).returning();

    await notify({
      companyId: req.companyId,
      userIds: [userId],
      actorId: req.userId,
      type: "job_assigned",
      meta: { jobName: job.name },
      link: "Jobs",
    });

    res.status(201).json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/jobs/:id/crew/:userId — เอาทีมงานออกจาก job
jobsRouter.delete("/:id/crew/:userId", async (req, res) => {
  try {
    const [job] = await db
      .select({ name: jobs.name })
      .from(jobs)
      .where(and(eq(jobs.id, req.params.id), eq(jobs.companyId, req.companyId)));

    await db
      .delete(jobCrew)
      .where(and(eq(jobCrew.jobId, req.params.id), eq(jobCrew.userId, req.params.userId)));

    if (job) {
      await notify({
        companyId: req.companyId,
        userIds: [req.params.userId],
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

// POST /api/jobs/:id/stock — batch set stock items สำหรับ job (replace all)
jobsRouter.post("/:id/stock", async (req, res) => {
  try {
    const { items }: { items: { stockItemId: string; quantity: number }[] } = req.body;

    await db.delete(jobStock).where(eq(jobStock.jobId, req.params.id));

    if (items && items.length > 0) {
      await db.insert(jobStock).values(
        items.map((item) => ({
          jobId:       req.params.id,
          stockItemId: item.stockItemId,
          quantity:    item.quantity,
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
    const items = equipment.map(({ category, itemName, quantity }) => ({ category, itemName, quantity }));

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

// GET /api/jobs/:id/vehicles
jobsRouter.get("/:id/vehicles", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(jobVehicles)
      .where(and(eq(jobVehicles.jobId, req.params.id), eq(jobVehicles.companyId, req.companyId)))
      .orderBy(desc(jobVehicles.createdAt));
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch job vehicles" });
  }
});

// POST /api/jobs/:id/vehicles — เพิ่มรถที่ใช้ในงาน
jobsRouter.post("/:id/vehicles", async (req, res) => {
  try {
    const data = insertJobVehicleSchema.parse({
      ...req.body,
      jobId:     req.params.id,
      companyId: req.companyId,
    });

    const [vehicle] = await db.insert(jobVehicles).values(data).returning();
    res.status(201).json(vehicle);
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
    res.status(500).json({ message: "Failed to delete vehicle" });
  }
});
