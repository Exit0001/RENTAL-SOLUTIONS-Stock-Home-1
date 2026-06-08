// ไฟล์นี้จัดการการเชื่อมต่อกับ PostgreSQL database
// และ run migrations อัตโนมัติทุกครั้งที่ server start

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "@shared/schema";
import { log } from "./index";

// Pool คือกลุ่ม connection ที่เปิดทิ้งไว้ล่วงหน้า
// แทนที่จะเปิด-ปิด connection ทุก request (ช้า)
// Pool จัดการให้อัตโนมัติ (เร็วกว่ามาก)
// ลบ ?sslmode=require ออกจาก URL และใช้ ssl config จาก Pool แทน
// เพื่อป้องกัน conflict ระหว่าง sslmode ใน URL กับ ssl object
const connectionString = (process.env.DATABASE_URL || "").replace("?sslmode=require", "");

const pool = new Pool({
  connectionString,
  max: 10,
  ssl: { rejectUnauthorized: false },
});

// db คือ object หลักที่ใช้ query database ทั่วทั้งแอป
// ส่ง schema ไปด้วยเพื่อให้ TypeScript รู้จัก table ทั้งหมด
export const db = drizzle(pool, { schema });

// runMigrations — รันทุกครั้งที่ server start
// Drizzle จะเช็คว่า migration ไหนยังไม่ได้รัน แล้วรันเฉพาะอันใหม่
// ถ้า migration รันไปแล้ว จะ skip อัตโนมัติ (ไม่รันซ้ำ)
export async function runMigrations() {
  try {
    log("Running database migrations...", "db");
    await migrate(db, { migrationsFolder: "./migrations" });
    log("Migrations completed successfully", "db");
  } catch (error: any) {
    // 42710 = type already exists, 42P07 = table already exists
    // เกิดเมื่อ SQL ถูกรันไปแล้วผ่าน SQL Editor
    const alreadyExists = error?.code === "42710" || error?.code === "42P07";
    if (alreadyExists) {
      log("Migration skipped — database already up to date", "db");
    } else {
      log(`Migration failed: ${error}`, "db");
      throw error;
    }
  }
}
