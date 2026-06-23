// One-off: คำนวณ health_score ใหม่ของทุก stock_unit จาก incident + maintenance history ที่มีอยู่แล้ว
// รันครั้งเดียวหลัง deploy ฟีเจอร์ health score แล้วลบไฟล์นี้ทิ้ง
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const { Pool } = pg;
const connectionString = (process.env.DATABASE_URL || "").replace("?sslmode=require", "");
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

const INCIDENT_PENALTY = {
  open:     { high: 25, medium: 15, low: 5 },
  resolved: { high: 10, medium: 5,  low: 2 },
};

const { rows: units } = await pool.query(`SELECT id FROM stock_units`);
console.log(`Recalculating health score for ${units.length} unit(s)...`);

for (const unit of units) {
  const { rows: unitIncidents } = await pool.query(
    `SELECT severity, status FROM incidents WHERE stock_unit_id = $1`,
    [unit.id]
  );
  const { rows: unitMaintenance } = await pool.query(
    `SELECT type, status FROM maintenance_logs WHERE stock_unit_id = $1`,
    [unit.id]
  );

  let score = 100;
  for (const inc of unitIncidents) {
    score -= inc.status === "open" ? INCIDENT_PENALTY.open[inc.severity] : INCIDENT_PENALTY.resolved[inc.severity];
  }
  for (const log of unitMaintenance) {
    if (log.status === "in_progress") score -= 10;
    else if (log.type === "repair") score -= 8;
  }
  score = Math.max(0, Math.min(100, score));

  await pool.query(`UPDATE stock_units SET health_score = $1 WHERE id = $2`, [score, unit.id]);
}

console.log("Done.");
await pool.end();
