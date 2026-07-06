import multer from "multer";
import { mkdirSync } from "fs";
import { join, extname } from "path";

export const uploadsDir = process.env.UPLOADS_DIR ?? "./data/uploads";
mkdirSync(uploadsDir, { recursive: true });

const allowedExtensions = new Set([
  ".xlsx",
  ".xls",
  ".csv",
  ".pdf",
  ".doc",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
]);

export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_ATTACHMENT_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!allowedExtensions.has(extname(file.originalname).toLowerCase())) {
      cb(new Error("ไม่รองรับไฟล์ประเภทนี้"));
      return;
    }
    cb(null, true);
  },
});

export function attachmentFilePath(storedName: string) {
  return join(uploadsDir, storedName);
}
