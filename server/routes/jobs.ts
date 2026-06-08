import { Router } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  jobs, jobStock, jobCrew, pullSheets, incidents, insertJobSchema,
  users, activityLog,
} from "@shared/schema";

export const jobsRouter = Router();

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

    // 4. นับ items จาก jobStock
    const stockCounts: Record<string, number> = {};
    for (const jid of jobIds) {
      const stock = await db.select({ qty: jobStock.quantity }).from(jobStock).where(eq(jobStock.jobId, jid));
      stockCounts[jid] = stock.reduce((s, s2) => s + s2.qty, 0);
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
      const nextJob    = assignments.find((a) => a.jobStatus === "scheduled");

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

// GET /api/jobs/:id — ดึงงานพร้อม stock และ crew
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

    const [stock, crew, sheets] = await Promise.all([
      db.select().from(jobStock).where(eq(jobStock.jobId, job.id)),
      db.select().from(jobCrew).where(eq(jobCrew.jobId, job.id)),
      db.select().from(pullSheets).where(eq(pullSheets.jobId, job.id)),
    ]);

    res.json({ ...job, stock, crew, pullSheets: sheets });
  } catch {
    res.status(500).json({ message: "Failed to fetch job" });
  }
});

// POST /api/jobs — สร้างงานใหม่
jobsRouter.post("/", async (req, res) => {
  try {
    const data = insertJobSchema.parse({
      ...req.body,
      companyId: req.companyId,
    });

    const [job] = await db.insert(jobs).values(data).returning();
    res.status(201).json(job);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/jobs/:id — อัปเดตงาน (เช่น เปลี่ยน status)
jobsRouter.put("/:id", async (req, res) => {
  try {
    const [job] = await db
      .update(jobs)
      .set(req.body)
      .where(and(
        eq(jobs.id, req.params.id),
        eq(jobs.companyId, req.companyId)
      ))
      .returning();

    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch {
    res.status(500).json({ message: "Failed to update job" });
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
    res.status(201).json(incident);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});
