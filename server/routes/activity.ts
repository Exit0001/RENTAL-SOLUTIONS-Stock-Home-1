import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { activityLog } from "@shared/schema";

export const activityRouter = Router();

// GET /api/activity — ดึง activity log ทั้งหมด (สำหรับหน้า History)
activityRouter.get("/", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.companyId, req.companyId))
      .orderBy(desc(activityLog.createdAt))
      .limit(100); // จำกัด 100 รายการล่าสุด
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch activity log" });
  }
});

// POST /api/activity — บันทึก activity (เรียกอัตโนมัติทุกครั้งที่มีการกระทำ)
activityRouter.post("/", async (req, res) => {
  try {
    const [entry] = await db
      .insert(activityLog)
      .values({
        companyId: req.companyId,
        userId: req.body.userId,
        type: req.body.type,
        action: req.body.action,
        detail: req.body.detail,
      })
      .returning();
    res.status(201).json(entry);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});
