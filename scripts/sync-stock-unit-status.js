/**
 * One-time backfill: sync stock_units.status for existing data created
 * before the automatic status-sync hooks (containers checkout/checkin,
 * maintenance log create/update/delete) were added.
 *
 * - Units with an open ("in_progress") maintenance log → status = 'maintenance'
 * - Units sitting inside a checked-out container (is_out = true) → status = 'out'
 * (Units already 'retired', or already matching, are left untouched.)
 *
 * Run: node scripts/sync-stock-unit-status.js
 */

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const { Pool } = pg;

const connectionString = (process.env.DATABASE_URL || "").replace("?sslmode=require", "");
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  const maintenanceResult = await pool.query(`
    UPDATE stock_units
    SET status = 'maintenance'
    WHERE status != 'retired'
      AND status != 'maintenance'
      AND id IN (
        SELECT stock_unit_id FROM maintenance_logs
        WHERE status = 'in_progress' AND stock_unit_id IS NOT NULL
      )
    RETURNING id, name;
  `);
  console.log(`Marked ${maintenanceResult.rowCount} unit(s) as 'maintenance':`);
  for (const row of maintenanceResult.rows) console.log(`  - ${row.name}`);

  const outResult = await pool.query(`
    UPDATE stock_units
    SET status = 'out'
    WHERE status = 'available'
      AND id IN (
        SELECT cu.stock_unit_id
        FROM container_units cu
        JOIN containers c ON c.id = cu.container_id
        WHERE c.is_out = true
      )
    RETURNING id, name;
  `);
  console.log(`Marked ${outResult.rowCount} unit(s) as 'out':`);
  for (const row of outResult.rows) console.log(`  - ${row.name}`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
