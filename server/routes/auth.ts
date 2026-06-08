import { Router } from "express";
import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { db } from "../db";
import { users, companies } from "@shared/schema";
import { requireAuth } from "../middleware/requireAuth";

export const authRouter = Router();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// Supabase Admin client สำหรับ invite users (ต้องใช้ service_role key)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// POST /api/auth/register — สร้าง company + user ครั้งแรก
authRouter.post("/register", async (req, res) => {
  try {
    const { authId, companyName, slug, userName, initials, email, token } = req.body;

    // ตรวจสอบ token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: "Invalid token" });

    // สร้าง company
    const [company] = await db
      .insert(companies)
      .values({ name: companyName, slug, plan: "free" })
      .returning();

    // สร้าง user เป็น admin
    const [dbUser] = await db
      .insert(users)
      .values({
        authId,
        companyId: company.id,
        username:  email,
        password:  "supabase-auth", // password จริงอยู่กับ Supabase
        name:      userName,
        initials,
        role:      "admin",
      })
      .returning();

    res.status(201).json({
      userId:      dbUser.id,
      companyId:   company.id,
      companyName: company.name,
    });
  } catch (err: any) {
    // แปล error จาก database ให้อ่านง่าย
    if (err.message?.includes("companies_slug_unique")) {
      return res.status(400).json({ message: "Slug นี้ถูกใช้แล้ว — กรุณาเลือก slug อื่น" });
    }
    if (err.message?.includes("users_username_unique")) {
      return res.status(400).json({ message: "อีเมลนี้มีบัญชีอยู่แล้ว — กรุณาเข้าสู่ระบบแทน" });
    }
    res.status(400).json({ message: err.message });
  }
});

// POST /api/auth/invite — Admin ส่งคำเชิญพนักงาน
authRouter.post("/invite", requireAuth, async (req, res) => {
  if (req.userRole !== "admin") {
    return res.status(403).json({ message: "เฉพาะ Admin เท่านั้น" });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ message: "SUPABASE_SERVICE_ROLE_KEY ยังไม่ได้ตั้งค่า" });
  }

  const { email, name, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ message: "กรุณากรอก email และ role" });
  }

  try {
    // ส่ง invite email ผ่าน Supabase — แนบ metadata ไปด้วย
    // หมายเหตุ: ไม่ส่ง name ใน metadata เพราะ Supabase SDK ไม่รองรับ non-ASCII (ภาษาไทย) ใน ByteString
    // พนักงานจะตั้งชื่อเองตอน accept invite ผ่านหน้า InvitePage
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        role,
        companyId: req.companyId,
      },
      redirectTo: process.env.APP_URL ?? "http://localhost:5000",
    });

    if (error) throw error;
    res.json({ message: `ส่งคำเชิญไปยัง ${email} แล้ว` });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// POST /api/auth/accept-invite — พนักงานยืนยัน invite และสร้าง DB record
authRouter.post("/accept-invite", async (req, res) => {
  const { name, token } = req.body;
  if (!name || !token) {
    return res.status(400).json({ message: "ข้อมูลไม่ครบ" });
  }

  try {
    // ตรวจสอบ token และดึง user metadata
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ message: "Token ไม่ถูกต้อง" });

    const meta      = user.user_metadata ?? {};
    const companyId = meta.companyId;
    const role      = meta.role ?? "crew";

    if (!companyId) {
      return res.status(400).json({ message: "ไม่พบข้อมูลบริษัทใน invite" });
    }

    // ตรวจสอบว่า user มีอยู่แล้วไหม
    const existing = await db.select().from(users).where(eq(users.authId, user.id));
    if (existing.length > 0) {
      // user มีอยู่แล้ว ดึงข้อมูล company แล้วส่งกลับ
      const [company] = await db.select().from(companies).where(eq(companies.id, companyId));
      return res.json({
        userId:      existing[0].id,
        companyId:   existing[0].companyId,
        companyName: company?.name ?? "",
        role:        existing[0].role,
      });
    }

    // สร้าง DB user record
    const initials = name.split(" ").map((n: string) => n[0] ?? "").join("").toUpperCase().slice(0, 2);
    const [dbUser] = await db.insert(users).values({
      authId:    user.id,
      companyId,
      username:  user.email!,
      password:  "supabase-auth",
      name,
      initials,
      role,
    }).returning();

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));

    res.status(201).json({
      userId:      dbUser.id,
      companyId:   dbUser.companyId,
      companyName: company?.name ?? "",
      role:        dbUser.role,
    });
  } catch (err: any) {
    if (err.message?.includes("users_username_unique")) {
      return res.status(400).json({ message: "อีเมลนี้มีบัญชีอยู่แล้ว" });
    }
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me — ดึงข้อมูล user ปัจจุบัน (ต้องมี JWT)
authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const [user] = await db
      .select({
        id:          users.id,
        name:        users.name,
        initials:    users.initials,
        role:        users.role,
        companyId:   users.companyId,
        companyName: companies.name,
      })
      .from(users)
      .leftJoin(companies, eq(users.companyId, companies.id))
      .where(eq(users.id, req.userId));

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});
