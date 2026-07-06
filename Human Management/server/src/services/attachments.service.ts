import { eq } from "drizzle-orm";
import { unlink } from "fs/promises";
import { db } from "../db/client";
import { jobAttachments } from "@app/shared/db/schema";
import { attachmentFilePath } from "../lib/uploads";
import { AppError } from "../lib/AppError";

export async function createAttachment(
  jobId: string,
  file: { originalname: string; filename: string; mimetype: string; size: number },
) {
  const [row] = await db
    .insert(jobAttachments)
    .values({
      jobId,
      fileName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      fileSize: file.size,
    })
    .returning();
  return row;
}

export async function listAttachments(jobId: string) {
  return db.select().from(jobAttachments).where(eq(jobAttachments.jobId, jobId));
}

export async function getAttachment(id: string) {
  const rows = await db.select().from(jobAttachments).where(eq(jobAttachments.id, id));
  return rows[0];
}

export async function deleteAttachment(id: string) {
  const attachment = await getAttachment(id);
  if (!attachment) {
    throw new AppError(404, "ไม่พบไฟล์นี้");
  }
  await db.delete(jobAttachments).where(eq(jobAttachments.id, id));
  await unlink(attachmentFilePath(attachment.storedName)).catch(() => {});
}
