import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

declare global {
  namespace Express {
    interface Request {
      companyId: string;
      userId: string;
      userRole: "admin" | "manager" | "crew";
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "No token provided" });

  // ตรวจสอบ JWT กับ Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ message: "Invalid token" });

  // ดึงข้อมูล user จาก DB ของเรา
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.authId, user.id));

  if (!dbUser) return res.status(401).json({ message: "User not registered" });

  req.companyId = dbUser.companyId;
  req.userId    = dbUser.id;
  req.userRole  = dbUser.role;
  next();
}
