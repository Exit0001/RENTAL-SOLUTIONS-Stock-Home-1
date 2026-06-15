import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { pushSubscriptions } from "@shared/schema";

export const pushRouter = Router();

// GET /api/push/vapid-public-key — public key สำหรับ pushManager.subscribe()
pushRouter.get("/vapid-public-key", (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — บันทึก/อัปเดต subscription ของ device นี้
pushRouter.post("/subscribe", async (req, res) => {
  try {
    const { endpoint, keys }: { endpoint: string; keys: { p256dh: string; auth: string } } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "ข้อมูล subscription ไม่ครบ" });
    }

    await db
      .insert(pushSubscriptions)
      .values({ companyId: req.companyId, userId: req.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: req.userId, companyId: req.companyId, p256dh: keys.p256dh, auth: keys.auth },
      });

    res.json({ message: "เปิดการแจ้งเตือนแล้ว" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/push/unsubscribe — ลบ subscription ของ device นี้
pushRouter.post("/unsubscribe", async (req, res) => {
  try {
    const { endpoint }: { endpoint: string } = req.body;
    if (!endpoint) return res.status(400).json({ message: "กรุณาระบุ endpoint" });

    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, req.userId)));

    res.json({ message: "ปิดการแจ้งเตือนแล้ว" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});
