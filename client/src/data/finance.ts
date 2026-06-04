// ข้อมูลทั้งหมดของหน้า Finance
import { TrendingUp, TrendingDown, DollarSign, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// --- Types ---

export type SummaryCard = {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
};

export type Quote = {
  id: string;
  client: string;
  project: string;
  items: number;
  value: string;
  stockAvail: string;
  status: string;
  date: string;
};

export type Invoice = {
  id: string;
  client: string;
  amount: string;
  date: string;
  due: string;
  status: string;
  daysLeft: number; // ลบ = เกินกำหนด
};

export type ProjectCost = {
  project: string;
  revenue: number;
  costs: number;      // ค่าอุปกรณ์
  staff: number;      // ค่าพนักงาน
  transport: number;  // ค่าขนส่ง
  subRentals: number; // ค่าเช่าจากบริษัทอื่น
  roi: number;        // Return on Investment (%)
};

export type LossItem = {
  category: string;
  amount: string;
  items: number;
  trend: string;
  desc: string;
};

export type AutoBillingItem = {
  id: string;
  client: string;
  asset: string;
  type: string;
  amount: string;
  contract: string;
  status: string;
};

// --- ข้อมูลจริง ---

export const summaryCards: SummaryCard[] = [
  { label: "Revenue (Month)", value: "£124,800", change: "+14.2%", icon: TrendingUp },
  { label: "Expenses",        value: "£41,280",  change: "+6.1%",  icon: TrendingDown },
  { label: "Net Profit",      value: "£83,520",  change: "+18.7%", icon: DollarSign },
  { label: "ROI",             value: "202%",     change: "+4.3%",  icon: Target },
];

export const quotes: Quote[] = [
  { id: "QT-018", client: "BBC Productions",    project: "Summer Broadcast",    items: 42, value: "£18,600", stockAvail: "100%", status: "Sent",     date: "16 Mar 2026" },
  { id: "QT-017", client: "Universal Music",    project: "Album Launch",        items: 28, value: "£12,400", stockAvail: "96%",  status: "Draft",    date: "15 Mar 2026" },
  { id: "QT-016", client: "Tech Conference Ltd",project: "Tech Conference AV",  items: 32, value: "£8,200",  stockAvail: "100%", status: "Accepted", date: "12 Mar 2026" },
  { id: "QT-015", client: "City Council",       project: "City Park Concert",   items: 56, value: "£15,300", stockAvail: "88%",  status: "Accepted", date: "10 Mar 2026" },
  { id: "QT-014", client: "Wedding Bliss",      project: "Wedding Reception",   items: 14, value: "£3,800",  stockAvail: "100%", status: "Accepted", date: "5 Mar 2026" },
  { id: "QT-013", client: "Starlight Prod.",    project: "Theatre Show",        items: 24, value: "£9,100",  stockAvail: "100%", status: "Declined", date: "1 Mar 2026" },
];

export const invoices: Invoice[] = [
  { id: "INV-0045", client: "Tech Conference Ltd",    amount: "£8,200",  date: "15 Mar", due: "30 Mar", status: "Pending", daysLeft: 14 },
  { id: "INV-0044", client: "Wedding Bliss Events",   amount: "£3,800",  date: "12 Mar", due: "27 Mar", status: "Pending", daysLeft: 11 },
  { id: "INV-0043", client: "Rock Festival GmbH",     amount: "£22,400", date: "10 Mar", due: "10 Mar", status: "Overdue", daysLeft: -6 },
  { id: "INV-0042", client: "Festival Sound Co.",     amount: "£12,400", date: "8 Mar",  due: "23 Mar", status: "Paid",    daysLeft: 0 },
  { id: "INV-0041", client: "Corporate Events Inc.",  amount: "£6,750",  date: "5 Mar",  due: "20 Mar", status: "Paid",    daysLeft: 0 },
  { id: "INV-0040", client: "City Council",           amount: "£15,300", date: "1 Mar",  due: "16 Mar", status: "Paid",    daysLeft: 0 },
  { id: "INV-0039", client: "University of Arts",     amount: "£4,200",  date: "28 Feb", due: "15 Mar", status: "Overdue", daysLeft: -1 },
];

export const projectCosts: ProjectCost[] = [
  { project: "Festival Sound 2026", revenue: 22400, costs: 6800, staff: 3200, transport: 1200, subRentals: 2800, roi: 229 },
  { project: "Corporate Gala",      revenue: 6750,  costs: 2100, staff: 1800, transport: 400,  subRentals: 0,    roi: 221 },
  { project: "Tech Conference AV",  revenue: 8200,  costs: 2400, staff: 2000, transport: 600,  subRentals: 1500, roi: 126 },
  { project: "Wedding Reception",   revenue: 3800,  costs: 800,  staff: 1200, transport: 300,  subRentals: 0,    roi: 165 },
  { project: "City Park Concert",   revenue: 15300, costs: 4200, staff: 4000, transport: 1800, subRentals: 0,    roi: 153 },
];

export const lossItems: LossItem[] = [
  { category: "Lost Equipment",   amount: "£2,340", items: 3, trend: "down", desc: "2x SM58, 1x DI Box — unaccounted after Festival Sound" },
  { category: "Damaged Equipment",amount: "£4,860", items: 5, trend: "up",   desc: "Repair costs from last 3 jobs" },
  { category: "Late Returns",     amount: "£1,200", items: 2, trend: "same", desc: "Sub-rental late fees from Partner Audio Ltd" },
  { category: "Unbilled Hours",   amount: "£680",   items: 0, trend: "down", desc: "Staff overtime not invoiced to client" },
];

export const autoBillingItems: AutoBillingItem[] = [
  { id: "AB-004", client: "Festival Sound Co.", asset: "SM58-015",     type: "Lost",   amount: "£280", contract: "Full replacement", status: "Pending" },
  { id: "AB-003", client: "Festival Sound Co.", asset: "SM58-016",     type: "Lost",   amount: "£280", contract: "Full replacement", status: "Pending" },
  { id: "AB-002", client: "Wedding Bliss",      asset: "QSC K12.2-003",type: "Damage", amount: "£120", contract: "Repair cost",      status: "Sent" },
  { id: "AB-001", client: "Corporate Events",   asset: "XLR20-012",    type: "Damage", amount: "£45",  contract: "Repair cost",      status: "Paid" },
];
