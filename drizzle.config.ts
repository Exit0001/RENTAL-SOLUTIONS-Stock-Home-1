import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — add it to your .env file");
}

export default defineConfig({
  // ไฟล์ schema ที่เราออกแบบไว้
  schema: "./shared/schema.ts",

  // โฟลเดอร์ที่เก็บไฟล์ migration (ต้อง commit ไปกับ git ด้วย!)
  out: "./migrations",

  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  },

  // แสดงรายละเอียดว่า SQL อะไรจะถูกรัน
  verbose: true,

  // เตือนก่อนทำ destructive action (เช่น ลบ column)
  strict: true,
});
