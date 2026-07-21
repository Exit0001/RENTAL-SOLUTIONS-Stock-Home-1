/**
 * Re-migrate tenyear_backup_2026-07-21.sql — idempotent, incremental.
 *
 *  - Cable category → BULK stock_items (quantity = sum of `total`), NO units.
 *    Existing Cable unit-items are converted to bulk + their wrong units deleted.
 *  - Everything else → UNIT stock_items + 1 unit per equipment row (dedup by barcode).
 *  - Skips anything already present (item by name, unit by barcode) — no duplicates.
 *
 * DRY-RUN by default (rolls back, just reports). Add `--apply` to commit.
 *   node scripts/migrate-tenyear-bulk.mjs           # dry run
 *   node scripts/migrate-tenyear-bulk.mjs --apply   # commit
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });
const APPLY = process.argv.includes("--apply");
const BACKUP = "tenyear_backup_2026-07-21.sql";
const BULK_CATEGORIES = new Set(["Cable"]);   // "สาย" → นับจำนวน (bulk)

const sqlText = readFileSync(join(__dirname, "..", BACKUP), "utf8");

// ── parse equipment rows (fields 1..8: id,barcode,name,category,subtype,brand,serial,total) ──
const STR = `'(?:[^'\\\\]|\\\\.|'')*'`;   // handle both \' and '' quote-escaping
const NUL = `(?:NULL|${STR})`;
const ROW_RE = new RegExp(
  `\\((\\d+),\\s*(${STR}),\\s*(${STR}),\\s*(${STR}),\\s*(${NUL}),\\s*(${NUL}),\\s*(${NUL}),\\s*(\\d+),`, "g"
);
const unq = (v) => {
  if (!v || v === "NULL") return "";
  return v.replace(/^'|'$/g, "").replace(/\\'/g, "'").replace(/''/g, "'").replace(/\\\\/g, "\\").trim();
};
const rows = [];
for (let m; (m = ROW_RE.exec(sqlText)); ) {
  rows.push({
    barcode: unq(m[2]), name: unq(m[3]), category: unq(m[4]),
    subtype: unq(m[5]), brand: unq(m[6]), serial: unq(m[7]), total: parseInt(m[8]),
  });
}
console.log(`Parsed ${rows.length} equipment rows`);
if (rows.length < 2000) { console.error("Parse looks wrong (<2000), aborting"); process.exit(1); }

// ── group by model (strip trailing #01/#02...) ──
const modelName = (n) => n.replace(/\s*#\d+$/, "").trim();
const models = new Map();  // model name → { name, category, subtype, brand, rows[], totalSum }
const brands = new Set(), cats = new Set(), subs = new Set();
for (const r of rows) {
  const mn = modelName(r.name);
  if (!models.has(mn)) models.set(mn, { name: mn, category: r.category, subtype: r.subtype, brand: r.brand, rows: [], totalSum: 0 });
  const g = models.get(mn);
  g.rows.push(r); g.totalSum += r.total;
  if (r.brand) brands.add(r.brand);
  if (r.category) cats.add(r.category);
  if (r.category && r.subtype) subs.add(`${r.category}||${r.subtype}`);
}
console.log(`Models: ${models.size} | brands: ${brands.size} | cats: ${cats.size} | subs: ${subs.size}`);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const stat = { itemsNew: 0, unitsNew: 0, cableConverted: 0, cableNew: 0, cableUnitsDeleted: 0, cableUnitsInJobs: 0, bulkQtyTotal: 0 };

async function run() {
  const client = await pool.connect();
  try {
    const co = (await client.query("SELECT id,name FROM companies LIMIT 1")).rows[0];
    if (!co) throw new Error("no company");
    console.log(`Company: ${co.name} (${co.id.slice(0, 8)})  |  MODE: ${APPLY ? "APPLY (commit)" : "DRY-RUN (rollback)"}`);
    await client.query("BEGIN");

    for (const b of brands) await client.query(`INSERT INTO brands (company_id,name) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [co.id, b]);
    for (const c of cats)   await client.query(`INSERT INTO categories (company_id,name) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [co.id, c]);
    for (const p of subs)   { const [pc, nm] = p.split("||"); await client.query(`INSERT INTO sub_categories (company_id,name,parent_category) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [co.id, nm, pc]); }

    const ensureItem = async (mdl, mode, qty) => {
      // insert-or-get by (company_id, name) — robust to prior partial runs
      const ins = await client.query(
        `INSERT INTO stock_items (company_id,name,brand,category,sub_category,quantity,tracking_mode)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (company_id, lower(name)) DO NOTHING RETURNING id`,
        [co.id, mdl.name, mdl.brand || "Unknown", mdl.category, mdl.subtype || "", qty, mode]);
      if (ins.rows[0]) return { id: ins.rows[0].id, isNew: true };
      const id = (await client.query(`SELECT id FROM stock_items WHERE company_id=$1 AND lower(name)=lower($2) LIMIT 1`, [co.id, mdl.name])).rows[0].id;
      return { id, isNew: false };
    };

    for (const [, mdl] of models) {
      // bulk = the model has any row with total>1 (a single row representing many pieces).
      // individually-serialized gear always has total=1 per row → stays unit.
      const isCable = mdl.rows.some((r) => r.total > 1);

      if (isCable) {
        const qty = mdl.totalSum;
        stat.bulkQtyTotal += qty;
        const { id: itemId, isNew } = await ensureItem(mdl, "bulk", qty);
        if (isNew) stat.cableNew++; else stat.cableConverted++;
        // force bulk + correct qty (idempotent whether item was new or existing)
        await client.query(`UPDATE stock_items SET tracking_mode='bulk', quantity=$2, brand=$3, category=$4, sub_category=$5 WHERE id=$1`,
          [itemId, qty, mdl.brand || "Unknown", mdl.category, mdl.subtype || ""]);
        // delete wrong units (count job-assigned first)
        const inJobs = (await client.query(`SELECT count(*)::int c FROM stock_units su JOIN job_units ju ON ju.stock_unit_id=su.id WHERE su.stock_item_id=$1`, [itemId])).rows[0].c;
        stat.cableUnitsInJobs += inJobs;
        const del = await client.query(`DELETE FROM stock_units WHERE stock_item_id=$1`, [itemId]);
        stat.cableUnitsDeleted += del.rowCount;
      } else {
        const { id: itemId, isNew } = await ensureItem(mdl, "unit", 0);
        if (isNew) stat.itemsNew++;
        // 1 unit per equipment row, dedup by barcode
        for (const r of mdl.rows) {
          if (r.barcode) {
            const ex = (await client.query(`SELECT 1 FROM stock_units WHERE company_id=$1 AND barcode=$2 LIMIT 1`, [co.id, r.barcode])).rows[0];
            if (ex) continue;
          }
          const ins = await client.query(
            `INSERT INTO stock_units (company_id,stock_item_id,name,serial_number,barcode,location,status) VALUES ($1,$2,$3,$4,$5,$6,'available') ON CONFLICT DO NOTHING`,
            [co.id, itemId, r.name, r.serial || null, r.barcode || null, null]);
          if (ins.rowCount > 0) stat.unitsNew++;
        }
      }
    }

    // sync unit-item quantity = count of units
    await client.query(`UPDATE stock_items si SET quantity=(SELECT count(*) FROM stock_units su WHERE su.stock_item_id=si.id) WHERE si.company_id=$1 AND si.tracking_mode='unit'`, [co.id]);

    console.log("\n=== SUMMARY (what this run does) ===");
    console.table(stat);
    const after = {
      items: (await client.query("SELECT count(*)::int c FROM stock_items WHERE company_id=$1", [co.id])).rows[0].c,
      bulk:  (await client.query("SELECT count(*)::int c FROM stock_items WHERE company_id=$1 AND tracking_mode='bulk'", [co.id])).rows[0].c,
      units: (await client.query("SELECT count(*)::int c FROM stock_units WHERE company_id=$1", [co.id])).rows[0].c,
      cablePieces: (await client.query("SELECT coalesce(sum(quantity),0)::int c FROM stock_items WHERE company_id=$1 AND category='Cable' AND tracking_mode='bulk'", [co.id])).rows[0].c,
      totalPieces: (await client.query("SELECT (SELECT count(*) FROM stock_units WHERE company_id=$1) + (SELECT coalesce(sum(quantity),0) FROM stock_items WHERE company_id=$1 AND tracking_mode='bulk') AS c", [co.id])).rows[0].c,
    };
    console.log("=== DB STATE AFTER (in-transaction) ===");
    console.table(after);

    if (APPLY) { await client.query("COMMIT"); console.log("\n✅ COMMITTED"); }
    else { await client.query("ROLLBACK"); console.log("\n↩️  DRY-RUN — rolled back (nothing changed). Re-run with --apply to commit."); }
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERR", e.message); process.exit(1);
  } finally {
    client.release(); await pool.end();
  }
}
run();
