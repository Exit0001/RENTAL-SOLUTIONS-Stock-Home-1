import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { pushSubscriptions, type NotificationType } from "@shared/schema";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:admin@example.com",
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// แปลง type + meta เป็นข้อความไทย (mirror ของ client/src/locales/th/notifications.json)
export function formatPushText(type: NotificationType, meta: Record<string, string | number> = {}) {
  switch (type) {
    case "job_assigned":
      return { title: "ได้รับมอบหมายงาน", body: `คุณได้รับมอบหมายให้เข้าร่วมงาน "${meta.jobName}"` };
    case "job_removed":
      return { title: "ถอนออกจากงาน", body: `คุณถูกถอนออกจากงาน "${meta.jobName}"` };
    case "job_updated":
      return { title: "งานมีการเปลี่ยนแปลง", body: `งาน "${meta.jobName}" มีการเปลี่ยนแปลง — สถานะ: ${meta.status}` };
    case "pullsheet_assigned":
      return { title: "ได้รับมอบหมายใบเบิกอุปกรณ์", body: `คุณได้รับมอบหมายใบเบิกอุปกรณ์สำหรับงาน "${meta.jobName}"` };
    case "maintenance_assigned":
      return { title: "ได้รับมอบหมายงานซ่อมบำรุง", body: `คุณได้รับมอบหมายงานซ่อมบำรุง ${meta.count} รายการ` };
    case "stock_added":
      return { title: "มีการเพิ่มสต็อกใหม่", body: `${meta.actorName} เพิ่ม "${meta.itemName}" เข้าสต็อก` };
  }
}

// ส่ง push ไปยังทุก device ที่ user เปิดใช้งานไว้ — ไม่ throw, ลบ subscription ที่หมดอายุ
export async function sendPushToUser(userId: string, payload: { title: string; body: string; link?: string | null }) {
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      } else {
        console.error("Push send failed:", err);
      }
    }
  }
}
