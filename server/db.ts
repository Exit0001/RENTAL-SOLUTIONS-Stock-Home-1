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
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // connection พร้อมกันสูงสุด 10 ตัว
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
  } catch (error) {
    log(`Migration failed: ${error}`, "db");
    throw error; // หยุด server ถ้า migration ล้มเหลว
  }
}
