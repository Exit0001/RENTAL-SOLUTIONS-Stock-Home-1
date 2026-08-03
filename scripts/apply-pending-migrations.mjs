/**
 * Apply specific migration files directly over the Supabase connection.
 *
 * `npm run db:migrate` is unusable (duplicate 0004_ tag in the drizzle journal),
 * so pending SQL is applied statement-by-statement here instead.
 *
 * Usage:  node scripts/apply-pending-migrations.mjs 0024_job_day_schedules.sql 0026_company_logo.sql
 *
 * "already exists" errors are reported as SKIP, so re-running is safe.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

// duplicate_object / duplicate_table / duplicate_column / duplicate_index
const ALREADY_EXISTS = new Set(["42710", "42P07", "42701", "42P06", "42P16"]);

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/apply-pending-migrations.mjs <file.sql> [...]");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function splitStatements(sql) {
  return sql
    .split(/;\s*\r?\n/)
    // Strip leading `--` comment lines per chunk. Dropping any chunk that merely STARTS
    // with `--` silently discarded whole statements that were preceded by a comment
    // block, and the runner then reported "0 statements" as if the file were empty.
    .map((s) =>
      s
        .split(/\r?\n/)
        .filter((line) => !/^\s*--/.test(line))
        .join("\n")
        .trim()
    )
    .filter((s) => s.length > 0)
    .map((s) => (s.endsWith(";") ? s : s + ";"));
}

const client = await pool.connect();
let failed = false;

try {
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const statements = splitStatements(sql);
    console.log(`\n=== ${file} (${statements.length} statements) ===`);

    for (const stmt of statements) {
      const label = stmt.replace(/\s+/g, " ").slice(0, 90);
      try {
        await client.query(stmt);
        console.log(`  OK   ${label}`);
      } catch (err) {
        if (ALREADY_EXISTS.has(err.code)) {
          console.log(`  SKIP ${label}  (${err.message})`);
        } else {
          failed = true;
          console.error(`  FAIL ${label}\n       ${err.code} ${err.message}`);
        }
      }
    }
  }
} finally {
  client.release();
  await pool.end();
}

process.exit(failed ? 1 : 0);
