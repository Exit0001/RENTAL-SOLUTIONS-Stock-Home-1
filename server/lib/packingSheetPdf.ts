import PDFDocument from "pdfkit";

export type PackingSheetUnit = {
  id: string;
  name: string;
  serialNumber: string | null;
  barcode: string | null;
  status: string;
  itemName: string;
  category: string;
};

export type PackingSheetContainer = {
  id: string;
  name: string;
  type: string;
  location: string | null;
  barcode: string | null;
  isOut: boolean;
  items: PackingSheetUnit[];
};

export type GeneratePackingSheetPdfArgs = {
  companyName: string;
  containers: PackingSheetContainer[];
  jobName?: string;
};

const PAGE_MARGIN = 50;
const TABLE_RIGHT = 545;

const COL = {
  num:    PAGE_MARGIN,
  cat:    PAGE_MARGIN + 28,
  item:   PAGE_MARGIN + 128,
  sn:     PAGE_MARGIN + 293,
  bc:     PAGE_MARGIN + 383,
  status: PAGE_MARGIN + 458,
  check:  PAGE_MARGIN + 503,
};

export function generatePackingSheetPdf({
  companyName,
  containers,
  jobName,
}: GeneratePackingSheetPdfArgs): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });

  // ── Global Header ─────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#000000").text(companyName, { align: "left" });
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#000000").text("PACKING SHEET", { align: "right" });
  doc.moveDown(0.2);

  if (jobName) {
    doc.font("Helvetica").fontSize(10).fillColor("#000000").text(`Job: ${jobName}`, { align: "right" });
  }

  doc.font("Helvetica").fontSize(9).fillColor("#666666")
    .text(
      `Generated: ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
      { align: "right" }
    );

  doc.moveDown(0.8);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(TABLE_RIGHT, doc.y).strokeColor("#000000").lineWidth(1).stroke();
  doc.moveDown(1);

  if (containers.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#666666")
      .text("No racks/containers found.", PAGE_MARGIN, doc.y, {
        width: TABLE_RIGHT - PAGE_MARGIN,
        align: "center",
      });
    return doc;
  }

  // ── Per-rack sections ─────────────────────────────────────
  for (let ci = 0; ci < containers.length; ci++) {
    const container = containers[ci];

    if (ci > 0 && doc.y > doc.page.height - PAGE_MARGIN - 130) {
      doc.addPage();
    }

    // Rack header bar
    const headerY = doc.y;
    const headerHeight = 26;
    doc.rect(PAGE_MARGIN, headerY, TABLE_RIGHT - PAGE_MARGIN, headerHeight)
      .fillColor("#e8e8e8").fill();

    const typeStr   = container.type ? `(${container.type})` : "";
    const locStr    = container.location ? `— ${container.location}` : "";
    const countStr  = `${container.items.length} item${container.items.length !== 1 ? "s" : ""}`;

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000")
      .text(`${container.name} ${typeStr}`, PAGE_MARGIN + 6, headerY + 7, {
        width: 290,
        lineBreak: false,
      });

    doc.font("Helvetica").fontSize(9).fillColor("#444444")
      .text(locStr, PAGE_MARGIN + 302, headerY + 9, { width: 130, lineBreak: false });

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000")
      .text(countStr, TABLE_RIGHT - 82, headerY + 9, { width: 76, align: "right", lineBreak: false });

    doc.y = headerY + headerHeight + 5;

    const drawItemsHeader = () => {
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
      doc.text("#",          COL.num,    y, { width: 22 });
      doc.text("Category",   COL.cat,    y, { width: 95 });
      doc.text("Item Name",  COL.item,   y, { width: 160 });
      doc.text("Serial No.", COL.sn,     y, { width: 85 });
      doc.text("Barcode",    COL.bc,     y, { width: 70 });
      doc.text("Status",     COL.status, y, { width: 40 });
      doc.text("✓",          COL.check,  y, { width: 32, align: "center" });
      doc.moveDown(0.4);
      doc.moveTo(PAGE_MARGIN, doc.y).lineTo(TABLE_RIGHT, doc.y).strokeColor("#aaaaaa").lineWidth(0.5).stroke();
      doc.moveDown(0.4);
    };

    drawItemsHeader();

    if (container.items.length === 0) {
      doc.font("Helvetica").fontSize(9).fillColor("#999999")
        .text("— empty —", PAGE_MARGIN, doc.y, { width: TABLE_RIGHT - PAGE_MARGIN, align: "center" });
      doc.moveDown(0.6);
    } else {
      const sorted = [...container.items].sort((a, b) => {
        const catCmp = a.category.localeCompare(b.category);
        return catCmp !== 0 ? catCmp : a.itemName.localeCompare(b.itemName);
      });

      let rowNum = 1;
      for (const unit of sorted) {
        if (doc.y + 20 > doc.page.height - PAGE_MARGIN - 80) {
          doc.addPage();
          drawItemsHeader();
        }

        const y            = doc.y;
        const checkboxSize = 10;

        doc.font("Helvetica").fontSize(8).fillColor("#000000");
        doc.text(String(rowNum),            COL.num,    y, { width: 22,  lineBreak: false });
        doc.text(unit.category  || "—",     COL.cat,    y, { width: 95,  lineBreak: false });
        doc.text(unit.itemName  || "—",     COL.item,   y, { width: 160, lineBreak: false });
        doc.text(unit.serialNumber || "—",  COL.sn,     y, { width: 85,  lineBreak: false });
        doc.text(unit.barcode   || "—",     COL.bc,     y, { width: 70,  lineBreak: false });
        doc.text(unit.status,               COL.status, y, { width: 40,  lineBreak: false });
        doc.rect(COL.check + 11, y, checkboxSize, checkboxSize)
          .strokeColor("#000000").lineWidth(0.5).stroke();

        doc.moveDown(0.5);
        rowNum++;
      }
    }

    // Per-rack signature line
    doc.moveDown(0.5);
    const sigY = doc.y;
    doc.font("Helvetica").fontSize(8).fillColor("#000000");
    doc.moveTo(PAGE_MARGIN,       sigY + 14).lineTo(PAGE_MARGIN + 180, sigY + 14)
      .strokeColor("#000000").lineWidth(0.5).stroke();
    doc.text("Packed by:", PAGE_MARGIN, sigY + 17);
    doc.moveTo(PAGE_MARGIN + 210, sigY + 14).lineTo(PAGE_MARGIN + 330, sigY + 14)
      .strokeColor("#000000").lineWidth(0.5).stroke();
    doc.text("Date:", PAGE_MARGIN + 210, sigY + 17);

    doc.y = sigY + 35;

    if (ci < containers.length - 1) {
      doc.moveDown(0.5);
      doc.moveTo(PAGE_MARGIN, doc.y).lineTo(TABLE_RIGHT, doc.y)
        .strokeColor("#cccccc").lineWidth(0.75).stroke();
      doc.moveDown(1);
    }
  }

  return doc;
}
