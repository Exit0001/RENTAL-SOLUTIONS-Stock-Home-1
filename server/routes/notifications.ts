import { Router } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db } from "../db";
import { notifications } from "@shared/schema";

export const notificationsRouter = Router();

// GET /api/notifications — แจ้งเตือนล่าสุดของ user ปัจจุบัน
notificationsRouter.get("/", async (req, res) => {
  try {
    const result = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.companyId, req.companyId), eq(notifications.userId, req.userId)))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    res.json(result);
  } catch {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// GET /api/notifications/unread-count
notificationsRouter.get("/unread-count", async (req, res) => {
  try {
    const [row] = await db
      .select({ total: count() })
      .from(notifications)
      .where(and(
        eq(notifications.companyId, req.companyId),
        eq(notifications.userId, req.userId),
        eq(notifications.isRead, false)
      ));
    res.json({ count: row?.total ?? 0 });
  } catch {
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
});

// PUT /api/notifications/read-all — อ่านทั้งหมด
// ต้องอยู่ก่อน /:id/read เพื่อกัน Express จับ "read-all" เป็น :id
notificationsRouter.put("/read-all", async (req, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.companyId, req.companyId),
        eq(notifications.userId, req.userId),
        eq(notifications.isRead, false)
      ));
    res.json({ message: "All notifications marked as read" });
  } catch {
    res.status(500).json({ message: "Failed to mark notifications as read" });
  }
});

// PUT /api/notifications/:id/read
notificationsRouter.put("/:id/read", async (req, res) => {
  try {
    const [row] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, req.userId)))
      .returning();

    if (!row) return res.status(404).json({ message: "Notification not found" });
    res.json(row);
  } catch {
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
});
