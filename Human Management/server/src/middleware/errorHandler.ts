import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { AppError } from "../lib/AppError";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "ข้อมูลไม่ถูกต้อง", details: err.flatten() });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "ไฟล์มีขนาดใหญ่เกินไป (เกิน 20MB)" : err.message;
    res.status(400).json({ error: message });
    return;
  }

  if (err instanceof Error && err.message === "ไม่รองรับไฟล์ประเภทนี้") {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err && typeof err === "object" && "code" in err && typeof err.code === "string" && err.code.startsWith("SQLITE_CONSTRAINT")) {
    res.status(409).json({ error: "ข้อมูลนี้ซ้ำกับที่มีอยู่แล้ว" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
};
