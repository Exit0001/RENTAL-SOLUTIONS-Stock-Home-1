import PDFDocument from "pdfkit";
import type { Job } from "@shared/schema";

export type PullSheetItem = {
  category: string;
  itemName: string;
  quantity: number;
  zone?:    string | null;  // โซนในงาน (FOH/Mon/Power/Stage) — จัด section ตามนี้
};

export type GeneratePullSheetPdfArgs = {
  companyName: string;
  job: Job;
  items: PullSheetItem[];
};

const PAGE_MARGIN = 50;
const COL = {
  num:    PAGE_MARGIN,
  cat:    PAGE_MARGIN + 30,
  item:   PAGE_MARGIN + 160,
  qty:    PAGE_MARGIN + 390,
  picked: PAGE_MARGIN + 450,
};
const TABLE_RIGHT = 545;

const fmtDate = (d: Date | string | null): string => {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export function generatePullSheetPdf({ companyName, job, items }: GeneratePullSheetPdfArgs): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });

  // ── Header ──────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#000000").text(companyName, { align: "left" });
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#000000").text("PULL SHEET", { align: "right" });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9).fillColor("#666666")
    .text(`Generated: ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`, { align: "right" });

  doc.moveDown(1);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(TABLE_RIGHT, doc.y).strokeColor("#000000").lineWidth(1).stroke();
  doc.moveDown(0.8);

  // ── Job info block ──────────────────────────────────────
  const infoTop = doc.y;
  const infoLineHeight = 18;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000");
  doc.text("Job:", PAGE_MARGIN, infoTop, { continued: true, width: 250 });
  doc.font("Helvetica").text(` ${job.name}`);

  doc.font("Helvetica-Bold").text("Client:", PAGE_MARGIN, infoTop + infoLineHeight, { continued: true, width: 250 });
  doc.font("Helvetica").text(` ${job.client}`);

  doc.font("Helvetica-Bold").text("Location:", PAGE_MARGIN, infoTop + infoLineHeight * 2, { continued: true, width: 250 });
  doc.font("Helvetica").text(` ${job.location || "—"}`);

  doc.font("Helvetica-Bold").text("Dates:", PAGE_MARGIN + 280, infoTop, { continued: true, width: 220 });
  doc.font("Helvetica").text(` ${fmtDate(job.startDate)} – ${fmtDate(job.endDate)}`);

  doc.font("Helvetica-Bold").text("Status:", PAGE_MARGIN + 280, infoTop + infoLineHeight, { continued: true, width: 220 });
  doc.font("Helvetica").text(` ${job.status.charAt(0).toUpperCase() + job.status.slice(1)}`);

  doc.y = infoTop + infoLineHeight * 3 + 10;
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(TABLE_RIGHT, doc.y).strokeColor("#cccccc").lineWidth(1).stroke();
  doc.moveDown(0.8);

  // ── Equipment table ───────────────────────────────────────
  const drawTableHeader = () => {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
    doc.text("#", COL.num, y, { width: 25 });
    doc.text("Category", COL.cat, y, { width: 125 });
    doc.text("Item", COL.item, y, { width: 225 });
    doc.text("Qty", COL.qty, y, { width: 50, align: "right" });
    doc.text("Picked", COL.picked, y, { width: 95, align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(TABLE_RIGHT, doc.y).strokeColor("#000000").lineWidth(1).stroke();
    doc.moveDown(0.5);
  };

  const ensureSpace = (needed: number) => {
    if (doc.y + needed > doc.page.height - PAGE_MARGIN - 80) {
      doc.addPage();
      drawTableHeader();
    }
  };

  drawTableHeader();

  if (items.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#666666")
      .text("No equipment assigned to this job yet.", PAGE_MARGIN, doc.y, { width: TABLE_RIGHT - PAGE_MARGIN, align: "center" });
    doc.moveDown(1);
  } else {
    // จัด section ตามโซน (FOH/Mon/Power/Stage) — ของที่ไม่ระบุโซนไปกลุ่ม "General" ท้ายสุด
    const GENERAL = "General";
    const zoneOf  = (i: PullSheetItem) => (i.zone && i.zone.trim()) ? i.zone : GENERAL;
    const zones = Array.from(new Set(items.map(zoneOf))).sort((a, b) => {
      if (a === GENERAL) return 1;
      if (b === GENERAL) return -1;
      return a.localeCompare(b);
    });
    let rowNum = 1;

    for (const zone of zones) {
      ensureSpace(46);
      // Zone header (แถบเทา)
      const zy = doc.y;
      doc.rect(PAGE_MARGIN, zy - 2, TABLE_RIGHT - PAGE_MARGIN, 16).fill("#eeeeee");
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000")
        .text(zone.toUpperCase(), COL.num + 2, zy + 2, { width: TABLE_RIGHT - COL.num });
      doc.moveDown(1.1);

      const rows = items
        .filter((i) => zoneOf(i) === zone)
        .sort((a, b) => a.category.localeCompare(b.category) || a.itemName.localeCompare(b.itemName));

      for (const row of rows) {
        ensureSpace(24);
        const y = doc.y;
        const checkboxSize = 11;

        doc.font("Helvetica").fontSize(9).fillColor("#000000");
        doc.text(String(rowNum), COL.num, y, { width: 25 });
        doc.fillColor("#666666").text(row.category, COL.cat, y, { width: 125 });
        doc.fillColor("#000000").text(row.itemName, COL.item, y, { width: 225 });
        doc.text(String(row.quantity), COL.qty, y, { width: 50, align: "right" });
        doc.rect(COL.picked + 40, y, checkboxSize, checkboxSize).strokeColor("#000000").lineWidth(0.75).stroke();

        doc.moveDown(0.6);
        rowNum++;
      }
      doc.moveDown(0.4);
    }
  }

  // ── Footer / signature lines ─────────────────────────────
  const footerY = doc.page.height - PAGE_MARGIN - 60;
  if (doc.y > footerY) {
    doc.addPage();
  }
  doc.y = Math.max(doc.y + 20, footerY);

  const sigY = doc.y;
  doc.font("Helvetica").fontSize(9).fillColor("#000000");
  doc.moveTo(PAGE_MARGIN, sigY + 20).lineTo(PAGE_MARGIN + 220, sigY + 20).strokeColor("#000000").lineWidth(1).stroke();
  doc.text("Packed by:", PAGE_MARGIN, sigY + 25, { continued: true });
  doc.text("                              Date:", { continued: false });

  doc.moveTo(PAGE_MARGIN + 280, sigY + 20).lineTo(PAGE_MARGIN + 280 + 220, sigY + 20).strokeColor("#000000").lineWidth(1).stroke();
  doc.text("Received by:", PAGE_MARGIN + 280, sigY + 25, { continued: true });
  doc.text("                          Date:", { continued: false });

  return doc;
}
