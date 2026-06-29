import PDFDocument from "pdfkit";
import type { Quote, Invoice } from "@shared/schema";

const PAGE_MARGIN = 50;
const TABLE_RIGHT = 545;

const fmtDate = (d: Date | string | null): string => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function drawHeader(doc: PDFKit.PDFDocument, companyName: string, docTitle: string) {
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#000000").text(companyName, { align: "left" });
  doc.font("Helvetica-Bold").fontSize(22).fillColor("#000000").text(docTitle, { align: "right" });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9).fillColor("#666666")
    .text(`Generated: ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`, { align: "right" });

  doc.moveDown(1);
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(TABLE_RIGHT, doc.y).strokeColor("#000000").lineWidth(1).stroke();
  doc.moveDown(0.8);
}

function drawField(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000").text(`${label}:`, x, y, { continued: true, width });
  doc.font("Helvetica").text(` ${value}`);
}

export type GenerateQuotePdfArgs = {
  companyName: string;
  quote: Quote;
  jobName: string | null;
};

export function generateQuotePdf({ companyName, quote, jobName }: GenerateQuotePdfArgs): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
  drawHeader(doc, companyName, "QUOTE");

  const infoTop = doc.y;
  const lineHeight = 18;

  drawField(doc, "Quote No.", quote.quoteNumber, PAGE_MARGIN, infoTop, 250);
  drawField(doc, "Client", quote.client, PAGE_MARGIN, infoTop + lineHeight, 250);
  drawField(doc, "Job", jobName ?? "—", PAGE_MARGIN, infoTop + lineHeight * 2, 250);

  drawField(doc, "Date", fmtDate(quote.createdAt), PAGE_MARGIN + 280, infoTop, 220);
  drawField(doc, "Status", capitalize(quote.status), PAGE_MARGIN + 280, infoTop + lineHeight, 220);

  doc.y = infoTop + lineHeight * 3 + 10;
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(TABLE_RIGHT, doc.y).strokeColor("#cccccc").lineWidth(1).stroke();
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text("Total Value", PAGE_MARGIN, doc.y, { continued: true, width: 300 });
  doc.font("Helvetica-Bold").fontSize(16).text(`  £${Number(quote.totalValue).toLocaleString()}`, { align: "right", width: TABLE_RIGHT - PAGE_MARGIN - 300 });

  return doc;
}

export type GenerateInvoicePdfArgs = {
  companyName: string;
  invoice: Invoice;
  jobName: string | null;
};

export function generateInvoicePdf({ companyName, invoice, jobName }: GenerateInvoicePdfArgs): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
  drawHeader(doc, companyName, "INVOICE");

  const infoTop = doc.y;
  const lineHeight = 18;

  drawField(doc, "Invoice No.", invoice.invoiceNumber, PAGE_MARGIN, infoTop, 250);
  drawField(doc, "Client", invoice.client, PAGE_MARGIN, infoTop + lineHeight, 250);
  drawField(doc, "Job", jobName ?? "—", PAGE_MARGIN, infoTop + lineHeight * 2, 250);

  drawField(doc, "Issued", fmtDate(invoice.issuedDate), PAGE_MARGIN + 280, infoTop, 220);
  drawField(doc, "Due", fmtDate(invoice.dueDate), PAGE_MARGIN + 280, infoTop + lineHeight, 220);
  drawField(doc, "Status", capitalize(invoice.status), PAGE_MARGIN + 280, infoTop + lineHeight * 2, 220);

  doc.y = infoTop + lineHeight * 3 + 10;
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(TABLE_RIGHT, doc.y).strokeColor("#cccccc").lineWidth(1).stroke();
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text("Amount Due", PAGE_MARGIN, doc.y, { continued: true, width: 300 });
  doc.font("Helvetica-Bold").fontSize(16).text(`  £${Number(invoice.amount).toLocaleString()}`, { align: "right", width: TABLE_RIGHT - PAGE_MARGIN - 300 });

  return doc;
}
