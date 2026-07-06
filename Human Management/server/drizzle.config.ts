import { defineConfig } from "drizzle-kit";
import "dotenv/config";

const databaseFile = process.env.DATABASE_FILE ?? "./data/app.db";

export default defineConfig({
  schema: "../packages/shared/src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: `file:${databaseFile}`,
  },
});
