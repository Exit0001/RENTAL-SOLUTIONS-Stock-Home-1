// ข้อมูลทั้งหมดของหน้า History & Analytics
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Wrench,
  Package,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ActivityEntry = {
  id: number;
  type: "stock" | "finance" | "maintenance" | "jobs"; // ใช้ union type จำกัดค่าที่เป็นไปได้
  action: string;
  detail: string;
  person: string;
  time: string;
  icon: LucideIcon;
  color: string;
};

export type UtilizationCategory = {
  category: string;
  pct: number; // เปอร์เซ็นต์การใช้งาน
};

export type HealthMetric = {
  label: string;
  value: string;
  color: string;
};

export type RevenueMonth = {
  month: string;
  revenue: number;
  profit: number;
};

// --- ข้อมูลจริง ---

export const activityLog: ActivityEntry[] = [
  { id: 1,  type: "stock",       action: "Checked Out",      detail: "24x J8 Loudspeaker → Festival Sound 2026",           person: "James Wilson", time: "Today, 09:15",      icon: ArrowRight,   color: "text-blue-400" },
  { id: 2,  type: "stock",       action: "Checked Out",      detail: "8x SL-Sub → Festival Sound 2026",                   person: "Mike Torres",  time: "Today, 09:30",      icon: ArrowRight,   color: "text-blue-400" },
  { id: 3,  type: "finance",     action: "Invoice Paid",     detail: "INV-0042 — Festival Sound Co. — £12,400",           person: "System",       time: "Today, 08:50",      icon: DollarSign,   color: "text-emerald-400" },
  { id: 4,  type: "maintenance", action: "Repair Started",   detail: "J8-004 — driver cone replacement",                  person: "Mike Torres",  time: "Yesterday, 16:20",  icon: Wrench,       color: "text-amber-400" },
  { id: 5,  type: "stock",       action: "Returned",         detail: "14x items — Wedding Reception",                     person: "Sarah Chen",   time: "Yesterday, 22:30",  icon: CheckCircle2, color: "text-emerald-400" },
  { id: 6,  type: "jobs",        action: "Job Completed",    detail: "Wedding Reception — all items returned",            person: "Sarah Chen",   time: "Yesterday, 22:45",  icon: CheckCircle2, color: "text-emerald-400" },
  { id: 7,  type: "maintenance", action: "Damage Reported",  detail: "J8-004 — dropped during load-in, cone damaged",    person: "Mike Torres",  time: "Yesterday, 16:15",  icon: AlertTriangle,color: "text-red-400" },
  { id: 8,  type: "finance",     action: "Quote Sent",       detail: "QT-2026-031 — City Park Concert — £18,900",         person: "Emma Davis",   time: "14 Mar, 14:30",     icon: DollarSign,   color: "text-[#FFFF00]" },
  { id: 9,  type: "stock",       action: "Checked Out",      detail: "18x items → Corporate Gala",                       person: "Emma Davis",   time: "14 Mar, 10:00",     icon: ArrowRight,   color: "text-blue-400" },
  { id: 10, type: "jobs",        action: "Pull Sheet Created",detail: "PS-007 — Tech Conference AV — 32 items",           person: "James Wilson", time: "14 Mar, 09:00",     icon: Package,      color: "text-[#FFFF00]" },
  { id: 11, type: "maintenance", action: "Service Completed", detail: "GSL8-005 — input connector replaced",             person: "Mike Torres",  time: "12 Mar, 17:00",     icon: CheckCircle2, color: "text-emerald-400" },
  { id: 12, type: "finance",     action: "Invoice Created",  detail: "INV-0044 — Wedding Bliss — £3,200",                person: "System",       time: "11 Mar, 09:00",     icon: DollarSign,   color: "text-blue-400" },
  { id: 13, type: "stock",       action: "Sub-Rental Received",detail: "4x QSC K12.2 from Partner Audio Ltd",           person: "Tom Baker",    time: "10 Mar, 14:00",     icon: Package,      color: "text-purple-400" },
  { id: 14, type: "jobs",        action: "Crew Assigned",    detail: "4 crew members → City Park Concert",               person: "System",       time: "10 Mar, 11:00",     icon: Users,        color: "text-blue-400" },
  { id: 15, type: "maintenance", action: "Inspection Complete",detail: "SM58-008 — annual safety check passed",          person: "Sarah Chen",   time: "10 Mar, 10:30",     icon: CheckCircle2, color: "text-emerald-400" },
];

export const utilizationData: UtilizationCategory[] = [
  { category: "Line Array",  pct: 82 },
  { category: "Subwoofers",  pct: 74 },
  { category: "Microphones", pct: 61 },
  { category: "DI Boxes",    pct: 45 },
  { category: "Cables",      pct: 38 },
];

export const healthMetrics: HealthMetric[] = [
  { label: "Overall Health",    value: "87%",  color: "text-emerald-400" },
  { label: "Assets At Risk",    value: "6",    color: "text-amber-400" },
  { label: "Avg Age (months)",  value: "18.4", color: "text-white/60" },
];

export const revenueMonths: RevenueMonth[] = [
  { month: "Oct", revenue: 62400, profit: 38200 },
  { month: "Nov", revenue: 71500, profit: 44300 },
  { month: "Dec", revenue: 58200, profit: 34100 },
  { month: "Jan", revenue: 49800, profit: 28900 },
  { month: "Feb", revenue: 67300, profit: 41200 },
  { month: "Mar", revenue: 84520, profit: 52800 },
];
