import { eq } from "drizzle-orm";
import { db } from "../db";
import { notifications, users, type NotificationType } from "@shared/schema";

type NotifyOpts = {
  companyId: string;
  userIds: string[];
  actorId?: string | null;
  type: NotificationType;
  meta?: Record<string, string | number>;
  link?: string;
};

// บันทึกแจ้งเตือนให้ผู้รับที่ระบุ (ไม่รวมตัวเอง — ผู้ที่ทำให้เกิดการเปลี่ยนแปลง)
export async function notify({ companyId, userIds, actorId, type, meta, link }: NotifyOpts) {
  const recipients = Array.from(new Set(userIds)).filter((id) => id !== actorId);
  if (recipients.length === 0) return;

  await db.insert(notifications).values(
    recipients.map((userId) => ({
      companyId,
      userId,
      actorId: actorId ?? null,
      type,
      meta: meta ?? {},
      link: link ?? null,
    }))
  );
}

// บันทึกแจ้งเตือนให้ทุกคนในบริษัท (ยกเว้นผู้ที่ทำให้เกิดการเปลี่ยนแปลง)
export async function notifyCompany(opts: Omit<NotifyOpts, "userIds"> & { companyId: string }) {
  const companyUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.companyId, opts.companyId));

  await notify({ ...opts, userIds: companyUsers.map((u) => u.id) });
}
