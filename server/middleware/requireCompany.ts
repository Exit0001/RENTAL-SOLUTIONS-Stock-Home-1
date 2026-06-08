// Middleware ตรวจสอบว่า request มาจากบริษัทไหน
// ตอนนี้ใช้ header ชั่วคราว — จะเปลี่ยนเป็น JWT auth ใน Step 6
import type { Request, Response, NextFunction } from "express";

// เพิ่ม companyId เข้าไปใน Express Request type
// ทำให้ทุก route ที่ผ่าน middleware นี้รู้ว่าเป็นบริษัทไหน
declare global {
  namespace Express {
    interface Request {
      companyId: string;
    }
  }
}

export function requireCompany(req: Request, res: Response, next: NextFunction) {
  const companyId = req.headers["x-company-id"] as string;

  if (!companyId) {
    return res.status(401).json({ message: "x-company-id header is required" });
  }

  req.companyId = companyId;
  next();
}
