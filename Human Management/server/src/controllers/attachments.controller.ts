import type { Request, Response } from "express";
import * as attachmentsService from "../services/attachments.service";
import { attachmentFilePath } from "../lib/uploads";
import { AppError } from "../lib/AppError";
import { param } from "../lib/params";

export async function uploadAttachment(req: Request, res: Response) {
  if (!req.file) {
    throw new AppError(400, "กรุณาเลือกไฟล์");
  }
  const attachment = await attachmentsService.createAttachment(param(req, "jobId"), req.file);
  res.status(201).json(attachment);
}

export async function listAttachments(req: Request, res: Response) {
  const rows = await attachmentsService.listAttachments(param(req, "jobId"));
  res.json(rows);
}

export async function downloadAttachment(req: Request, res: Response) {
  const attachment = await attachmentsService.getAttachment(param(req, "id"));
  if (!attachment) {
    res.status(404).json({ error: "ไม่พบไฟล์นี้" });
    return;
  }
  res.download(attachmentFilePath(attachment.storedName), attachment.fileName);
}

export async function deleteAttachment(req: Request, res: Response) {
  await attachmentsService.deleteAttachment(param(req, "id"));
  res.status(204).send();
}
