// Apply the crew/vehicles migration DDL + seed crew_members from users + migrate job_crew → job_crew_members.
// One-off. Run: node scripts/migrate-crew.mjs
import pg from "pg";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const DB = env.split("\n").find((l) => l.startsWith("DATABASE_URL")).split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
const pool = new pg.Pool({ connectionString: DB });
const q = (s, p) => pool.query(s, p);

try {
  // 1) DDL — split the migration file on statement-breakpoint, skip comments; ignore "already exists"
  const ddl = readFileSync("migrations/0015_youthful_rictor.sql", "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/^--.*$/gm, "").trim())
    .filter(Boolean);
  for (const stmt of ddl) {
    try { await q(stmt); }
    catch (e) { if (/already exists|duplicate/i.test(e.message)) console.log("skip:", e.message.split("\n")[0]); else throw e; }
  }
  console.log("DDL applied.");

  // 2) Seed crew_members from users (own_crew, linked userId) — only if not already seeded
  const users = await q("SELECT id, company_id, name, role FROM users");
  let seeded = 0;
  for (const u of users.rows) {
    const [existing] = (await q("SELECT id FROM crew_members WHERE user_id = $1", [u.id])).rows;
    if (existing) continue;
    await q(
      `INSERT INTO crew_members (company_id, name, type, role, user_id) VALUES ($1,$2,'own_crew',$3,$4)`,
      [u.company_id, u.name, null, u.id]
    );
    seeded++;
  }
  console.log(`Seeded ${seeded} crew_members from users (skipped ${users.rows.length - seeded} already present).`);

  // 3) Migrate job_crew (userId) → job_crew_members (crewMemberId)
  const jc = await q("SELECT job_id, user_id, role FROM job_crew");
  let migrated = 0, skipped = 0;
  for (const row of jc.rows) {
    const [cm] = (await q("SELECT id FROM crew_members WHERE user_id = $1", [row.user_id])).rows;
    if (!cm) { skipped++; continue; }
    const [dupe] = (await q("SELECT id FROM job_crew_members WHERE job_id=$1 AND crew_member_id=$2", [row.job_id, cm.id])).rows;
    if (dupe) { skipped++; continue; }
    await q("INSERT INTO job_crew_members (job_id, crew_member_id, role) VALUES ($1,$2,$3)", [row.job_id, cm.id, row.role ?? null]);
    migrated++;
  }
  console.log(`Migrated ${migrated} job_crew → job_crew_members (skipped ${skipped}).`);

  // Verify
  const counts = {
    crew_members: (await q("SELECT count(*)::int c FROM crew_members")).rows[0].c,
    vehicles: (await q("SELECT count(*)::int c FROM vehicles")).rows[0].c,
    job_crew_members: (await q("SELECT count(*)::int c FROM job_crew_members")).rows[0].c,
  };
  console.log("counts:", counts);
  console.log("DONE");
} catch (e) {
  console.error("ERR", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
