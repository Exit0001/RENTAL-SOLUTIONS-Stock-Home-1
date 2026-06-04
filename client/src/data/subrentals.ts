// ข้อมูล Sub-Rentals (อุปกรณ์ที่ยืมมาจากบริษัทอื่น)

export type SubRental = {
  id: number;
  item: string;       // ชื่ออุปกรณ์และจำนวน
  partner: string;    // บริษัทที่ยืมมา
  project: string;    // งานที่ใช้
  dueBack: string;    // วันคืน
  status: string;     // "Active" | "Pending"
  dailyRate: string;  // ค่าเช่าต่อวัน
};

export const subRentals: SubRental[] = [
  { id: 1, item: "QSC K12.2 (x4)",              partner: "Partner Audio Ltd",  project: "Corporate Gala",        dueBack: "23 Mar 2026", status: "Active",  dailyRate: "£60/unit" },
  { id: 2, item: "Sennheiser EW 100 G4 (x6)",   partner: "Sound Solutions UK", project: "Festival Sound 2026",   dueBack: "21 Mar 2026", status: "Active",  dailyRate: "£35/unit" },
  { id: 3, item: "Martin MAC Aura (x8)",         partner: "Lighting Direct",    project: "Festival Sound 2026",   dueBack: "21 Mar 2026", status: "Active",  dailyRate: "£80/unit" },
  { id: 4, item: "Allen & Heath dLive S5000 (x1)", partner: "Console Hire Pro", project: "Tech Conference",      dueBack: "28 Mar 2026", status: "Pending", dailyRate: "£250/unit" },
];
