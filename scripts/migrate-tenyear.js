/**
 * Migration: tenyear_backup → STAK database
 *
 * Reads tenyear_backup_2026-06-09.sql and inserts:
 *   1. brands
 *   2. categories
 *   3. sub_categories
 *   4. stock_items  (1 per unique model, grouped by stripping #XX suffix)
 *   5. stock_units  (1 per physical item row)
 *
 * Run: node scripts/migrate-tenyear.js
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });

const { Pool } = pg;

// ─── Parse the SQL backup ────────────────────────────────────────────────────

const sqlText = readFileSync(
  join(__dirname, "../tenyear_backup_2026-06-09.sql"),
  "utf8"
);

// Each row is on one line:
// INSERT INTO `equipment` (`id`, `barcode`, `name`, `category`, `subtype`, `brand`, `serial_number`,
//   `total`, `available`, `in_use`, `location`, `note`, `created_at`, `updated_at`)
// VALUES (19, 'AMP-D&B-D80-001', 'd&b audiotechnik D80 #01', 'Amplifier', 'Amp', 'd&b audiotechnik',
//   'Z271000114210', 1, 1, 0, '', '', '2025-10-09 06:29:40', '2026-04-02 18:22:33');

const ROW_RE = /INSERT INTO `equipment`[^V]+VALUES\s*\((\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(NULL|'[^']*'),\s*(NULL|'[^']*'),\s*(NULL|'[^']*'),\s*(\d+),\s*(\d+),\s*(\d+),\s*(NULL|'[^']*'),\s*(NULL|'[^']*'),/g;

const strip = (v) => {
  if (!v || v === "NULL") return "";
  return v.replace(/^'|'$/g, "").trim();
};

const equipmentRows = [];
let m;
while ((m = ROW_RE.exec(sqlText)) !== null) {
  equipmentRows.push({
    id:           parseInt(m[1]),
    barcode:      strip(m[2]),
    name:         strip(m[3]),
    category:     strip(m[4]),
    subtype:      strip(m[5]),
    brand:        strip(m[6]),
    serialNumber: strip(m[7]),
    location:     strip(m[11]),
  });
}

console.log(`Parsed ${equipmentRows.length} equipment rows`);

if (equipmentRows.length === 0) {
  console.error("ERROR: No rows parsed — check regex or file path");
  process.exit(1);
}

// ─── Group by model (strip trailing #01, #02 etc.) ───────────────────────────

const modelName = (name) => name.replace(/\s*#\d+$/, "").trim();

const brandsSet     = new Set();
const categoriesSet = new Set();
const subCatSet     = new Set(); // "category||subtype"
const modelsMap     = new Map(); // model name → { name, category, subtype, brand }

for (const row of equipmentRows) {
  const model = modelName(row.name);
  if (!modelsMap.has(model)) {
    modelsMap.set(model, {
      name:     model,
      category: row.category,
      subtype:  row.subtype,
      brand:    row.brand,
    });
  }
  if (row.brand)    brandsSet.add(row.brand);
  if (row.category) categoriesSet.add(row.category);
  if (row.category && row.subtype) subCatSet.add(`${row.category}||${row.subtype}`);
}

console.log(`Unique models: ${modelsMap.size}`);
console.log(`Unique brands: ${brandsSet.size}`);
console.log(`Unique categories: ${categoriesSet.size}`);
console.log(`Unique sub-categories: ${subCatSet.size}`);

// ─── Connect to database ─────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    const companyRes = await client.query("SELECT id, name FROM companies LIMIT 1");
    if (companyRes.rows.length === 0) {
      console.error("ERROR: No company found in database. Register first.");
      process.exit(1);
    }
    const companyId = companyRes.rows[0].id;
    console.log(`\nUsing company: "${companyRes.rows[0].name}" (${companyId})`);

    await client.query("BEGIN");

    // ── 1. Brands ────────────────────────────────────────────────────────────
    console.log("\n[1/5] Inserting brands...");
    let brandCount = 0;
    for (const brand of brandsSet) {
      if (!brand) continue;
      await client.query(
        `INSERT INTO brands (company_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [companyId, brand]
      );
      brandCount++;
    }
    console.log(`  ✓ ${brandCount} brands`);

    // ── 2. Categories ─────────────────────────────────────────────────────────
    console.log("[2/5] Inserting categories...");
    let catCount = 0;
    for (const cat of categoriesSet) {
      if (!cat) continue;
      await client.query(
        `INSERT INTO categories (company_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [companyId, cat]
      );
      catCount++;
    }
    console.log(`  ✓ ${catCount} categories`);

    // ── 3. Sub-Categories ─────────────────────────────────────────────────────
    console.log("[3/5] Inserting sub-categories...");
    let subCatCount = 0;
    for (const pair of subCatSet) {
      const [parentCategory, name] = pair.split("||");
      if (!name) continue;
      await client.query(
        `INSERT INTO sub_categories (company_id, name, parent_category) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [companyId, name, parentCategory]
      );
      subCatCount++;
    }
    console.log(`  ✓ ${subCatCount} sub-categories`);

    // ── 4. Stock Items ────────────────────────────────────────────────────────
    console.log("[4/5] Inserting stock_items...");
    const modelToId = new Map();
    let itemCount = 0;

    for (const [, model] of modelsMap) {
      const res = await client.query(
        `INSERT INTO stock_items (company_id, name, brand, category, sub_category, quantity)
         VALUES ($1, $2, $3, $4, $5, 0)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          companyId,
          model.name,
          model.brand    || "Unknown",
          model.category || "Uncategorized",
          model.subtype  || "",
        ]
      );
      if (res.rows.length > 0) {
        modelToId.set(model.name, res.rows[0].id);
        itemCount++;
      } else {
        const existing = await client.query(
          `SELECT id FROM stock_items WHERE company_id = $1 AND name = $2 LIMIT 1`,
          [companyId, model.name]
        );
        if (existing.rows.length > 0) {
          modelToId.set(model.name, existing.rows[0].id);
        }
      }
    }
    console.log(`  ✓ ${itemCount} stock_items inserted`);

    // ── 5. Stock Units ────────────────────────────────────────────────────────
    console.log("[5/5] Inserting stock_units...");
    let unitCount = 0;
    let skipped   = 0;

    for (const row of equipmentRows) {
      const mName  = modelName(row.name);
      const itemId = modelToId.get(mName);
      if (!itemId) { skipped++; continue; }

      await client.query(
        `INSERT INTO stock_units (company_id, stock_item_id, name, serial_number, barcode, location, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'available')
         ON CONFLICT DO NOTHING`,
        [
          companyId,
          itemId,
          row.name,
          row.serialNumber || null,
          row.barcode      || null,
          row.location     || null,
        ]
      );
      unitCount++;
    }
    console.log(`  ✓ ${unitCount} stock_units inserted (${skipped} skipped)`);

    // ── 6. Update quantity counts ─────────────────────────────────────────────
    console.log("[6/6] Updating stock_items.quantity...");
    await client.query(
      `UPDATE stock_items si
       SET quantity = (SELECT COUNT(*) FROM stock_units su WHERE su.stock_item_id = si.id)
       WHERE si.company_id = $1`,
      [companyId]
    );
    console.log("  ✓ quantity updated");

    await client.query("COMMIT");
    console.log("\n Migration complete!");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n Migration failed — rolled back");
    console.error(err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
