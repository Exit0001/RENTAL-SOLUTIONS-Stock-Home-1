import { eq } from "drizzle-orm";
import { db } from "../db";
import { companies } from "@shared/schema";

// ส่งข้อความเข้ากลุ่ม LINE ของบริษัท (ถ้าตั้งค่าไว้)
// ไม่ throw — ถ้าส่งไม่สำเร็จ ไม่ควรทำให้ request หลักล้มเหลว
export async function sendLineMessage(companyId: string, text: string) {
  const [company] = await db
    .select({ token: companies.lineChannelAccessToken, groupId: companies.lineGroupId })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company?.token || !company?.groupId) return;

  try {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${company.token}`,
      },
      body: JSON.stringify({ to: company.groupId, messages: [{ type: "text", text }] }),
    });

    if (!res.ok) {
      console.error("LINE push failed:", res.status, await res.text());
    }
  } catch (err) {
    console.error("LINE push failed:", err);
  }
}
