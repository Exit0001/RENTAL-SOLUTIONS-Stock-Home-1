// ข้อมูล Maintenance Log (ประวัติการซ่อมบำรุง)

export type MaintenanceLog = {
  id: number;
  asset: string;   // รหัสอุปกรณ์
  type: string;    // "Repair" | "Preventive" | "Inspection"
  desc: string;
  date: string;
  tech: string;    // ช่างที่รับผิดชอบ
  status: string;  // "In Progress" | "Completed"
  cost: string;
};

export const maintenanceLogs: MaintenanceLog[] = [
  { id: 1, asset: "J8-004",     type: "Repair",     desc: "Replaced damaged driver cone",                          date: "15 Mar 2026", tech: "Mike Torres",  status: "In Progress", cost: "£320" },
  { id: 2, asset: "FP10K-004",  type: "Preventive", desc: "Scheduled annual service — fan replacement",           date: "14 Mar 2026", tech: "James Wilson", status: "In Progress", cost: "£85" },
  { id: 3, asset: "GSL8-005",   type: "Repair",     desc: "Intermittent signal — replaced input connector",       date: "12 Mar 2026", tech: "Mike Torres",  status: "Completed",   cost: "£45" },
  { id: 4, asset: "SM58-008",   type: "Inspection", desc: "Annual safety check and clean",                        date: "10 Mar 2026", tech: "Sarah Chen",   status: "Completed",   cost: "£15" },
  { id: 5, asset: "XLR20-012",  type: "Repair",     desc: "Replaced damaged connector — pin 2 broken",           date: "8 Mar 2026",  tech: "Tom Baker",    status: "Completed",   cost: "£8" },
  { id: 6, asset: "J8-012",     type: "Preventive", desc: "Re-coned woofer — approaching cycle limit",           date: "5 Mar 2026",  tech: "Mike Torres",  status: "Completed",   cost: "£280" },
];
