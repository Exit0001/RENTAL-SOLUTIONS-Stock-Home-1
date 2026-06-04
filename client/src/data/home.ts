// ไฟล์นี้เก็บข้อมูลทั้งหมดของหน้า Home
// แยกออกจาก component เพื่อให้อ่านง่ายขึ้น

import {
  Boxes,
  Briefcase,
  DollarSign,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// --- Types (บอก TypeScript ว่าข้อมูลแต่ละชิ้นมีรูปร่างอย่างไร) ---

export type KpiCard = {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down"; // มีแค่ 2 ค่าที่เป็นไปได้
  icon: LucideIcon;
  sub: string;
};

export type Notification = {
  id: number;
  type: string;
  title: string;
  desc: string;
  time: string;
  icon: LucideIcon;
  color: string;
};

export type Site = {
  name: string;
  location: string;
  assets: number;
  status: string;
  utilization: number;
};

export type QuickStat = {
  label: string;
  value: string;
  total: string;
};

// --- ข้อมูลจริง ---

export const kpiCards: KpiCard[] = [
  { title: "Total Assets",      value: "1,247",  change: "+12%",   trend: "up",   icon: Boxes,      sub: "Across 8 categories" },
  { title: "Active Jobs",       value: "23",     change: "+3",     trend: "up",   icon: Briefcase,  sub: "7 this week" },
  { title: "Revenue (Month)",   value: "£84,520",change: "+18.2%", trend: "up",   icon: DollarSign, sub: "vs £71,500 last month" },
  { title: "In Maintenance",    value: "34",     change: "-5",     trend: "down", icon: Wrench,     sub: "12 returning this week" },
];

export const notifications: Notification[] = [
  { id: 1, type: "alert",   title: "Low Stock Alert",       desc: "Only 2x Shure SM58 remaining in inventory",             time: "2 min ago",   icon: AlertTriangle, color: "text-amber-400" },
  { id: 2, type: "success", title: "Job Completed",         desc: "Wedding Reception — all 14 items checked back in",      time: "15 min ago",  icon: CheckCircle2,  color: "text-emerald-400" },
  { id: 3, type: "alert",   title: "Maintenance Due",       desc: "6x L-Acoustics A15 scheduled for service today",        time: "30 min ago",  icon: Wrench,        color: "text-orange-400" },
  { id: 4, type: "info",    title: "Sub-Rental Return",     desc: "Partner Audio Ltd — 4x QSC K12.2 due back tomorrow",    time: "1 hr ago",    icon: Clock,         color: "text-blue-400" },
  { id: 5, type: "success", title: "Invoice Paid",          desc: "Festival Sound Co. paid £12,400 (INV-0042)",             time: "1.5 hrs ago", icon: DollarSign,    color: "text-emerald-400" },
  { id: 6, type: "info",    title: "Pull Sheet Generated",  desc: "Tech Conference AV — 32 items ready for dispatch",      time: "2 hrs ago",   icon: Boxes,         color: "text-blue-400" },
];

export const sites: Site[] = [
  { name: "Main Warehouse",      location: "London",         assets: 892, status: "online", utilization: 78 },
  { name: "Festival Sound 2026", location: "Victoria Park",  assets: 48,  status: "active", utilization: 100 },
  { name: "Corporate Gala",      location: "The Dorchester", assets: 18,  status: "active", utilization: 100 },
  { name: "Backup Storage",      location: "Birmingham",     assets: 289, status: "online", utilization: 34 },
];

export const quickStats: QuickStat[] = [
  { label: "Assets Out",          value: "156", total: "1,247" },
  { label: "Health Score Avg",    value: "87%", total: "" },
  { label: "Sub-Rentals Active",  value: "12",  total: "" },
  { label: "Pull Sheets Pending", value: "3",   total: "" },
];
