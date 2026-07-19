import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db } from "../db";
import {
  crewMembers, vehicles, jobCrewMembers, jobVehicles, jobs,
  insertCrewMemberSchema, insertVehicleSchema,
} from "@shared/schema";

export const crewRouter = Router();

const canWrite = (role?: string) => role === "admin" || role === "manager";

// ─── CREW MEMBERS (roster) ────────────────────────────────

// GET /api/crew — รายชื่อทีมงานทั้งหมด (roster), filter ?type=
crewRouter.get("/", async (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const conds = [eq(crewMembers.companyId, req.companyId)];
    if (type) conds.push(eq(crewMembers.type, type as any));
    const rows = await db.select().from(crewMembers)
      .where(and(...conds))
      .orderBy(asc(crewMembers.type), asc(crewMembers.name));
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch crew members" });
  }
});

// GET /api/crew/matrix — { jobId, crewMemberId }[] (สำหรับ Gantt) — ต้องมาก่อน /:id
crewRouter.get("/matrix", async (req, res) => {
  try {
    const rows = await db
      .select({ jobId: jobCrewMembers.jobId, crewMemberId: jobCrewMembers.crewMemberId })
      .from(jobCrewMembers)
      .innerJoin(jobs, eq(jobCrewMembers.jobId, jobs.id))
      .where(eq(jobs.companyId, req.companyId));
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch crew matrix" });
  }
});

// ─── VEHICLES (roster) ────────────────────────────────────

crewRouter.get("/vehicles", async (req, res) => {
  try {
    const rows = await db.select().from(vehicles)
      .where(eq(vehicles.companyId, req.companyId))
      .orderBy(asc(vehicles.name));
    res.json(rows);
  } catch {
    res.status(500).json({ message: "Failed to fetch vehicles" });
  }
});

crewRouter.get("/vehicles/matrix", async (req, res) => {
  try {
    const rows = await db
      .select({ jobId: jobVehicles.jobId, vehicleId: jobVehicles.vehicleId })
      .from(jobVehicles)
      .innerJoin(jobs, eq(jobVehicles.jobId, jobs.id))
      .where(eq(jobs.companyId, req.companyId));
    // เฉพาะแถวที่ผูกคลังรถ (vehicleId not null)
    res.json(rows.filter((r) => r.vehicleId));
  } catch {
    res.status(500).json({ message: "Failed to fetch vehicle matrix" });
  }
});

crewRouter.post("/vehicles", async (req, res) => {
  try {
    if (!canWrite(req.userRole)) return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
    const data = insertVehicleSchema.parse({ ...req.body, companyId: req.companyId });
    const [row] = await db.insert(vehicles).values(data).returning();
    res.status(201).json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

crewRouter.put("/vehicles/:id", async (req, res) => {
  try {
    if (!canWrite(req.userRole)) return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
    const { companyId, id, createdAt, ...patch } = req.body ?? {};
    const [row] = await db.update(vehicles).set(patch)
      .where(and(eq(vehicles.id, req.params.id), eq(vehicles.companyId, req.companyId)))
      .returning();
    if (!row) return res.status(404).json({ message: "ไม่พบรถ" });
    res.json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

crewRouter.delete("/vehicles/:id", async (req, res) => {
  try {
    if (!canWrite(req.userRole)) return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
    await db.delete(vehicles).where(and(eq(vehicles.id, req.params.id), eq(vehicles.companyId, req.companyId)));
    res.json({ message: "ลบรถแล้ว" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ─── CREW MEMBER write ops (/:id ต้องอยู่ท้ายสุด) ──────────

crewRouter.post("/", async (req, res) => {
  try {
    if (!canWrite(req.userRole)) return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
    const data = insertCrewMemberSchema.parse({ ...req.body, companyId: req.companyId });
    const [row] = await db.insert(crewMembers).values(data).returning();
    res.status(201).json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

crewRouter.put("/:id", async (req, res) => {
  try {
    if (!canWrite(req.userRole)) return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
    const { companyId, id, createdAt, ...patch } = req.body ?? {};
    const [row] = await db.update(crewMembers).set(patch)
      .where(and(eq(crewMembers.id, req.params.id), eq(crewMembers.companyId, req.companyId)))
      .returning();
    if (!row) return res.status(404).json({ message: "ไม่พบทีมงาน" });
    res.json(row);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

crewRouter.delete("/:id", async (req, res) => {
  try {
    if (!canWrite(req.userRole)) return res.status(403).json({ message: "เฉพาะ Admin และ Manager เท่านั้น" });
    await db.delete(crewMembers).where(and(eq(crewMembers.id, req.params.id), eq(crewMembers.companyId, req.companyId)));
    res.json({ message: "ลบทีมงานแล้ว" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});
