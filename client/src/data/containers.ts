// ข้อมูล Containers (ลัง/ราก ที่ใส่อุปกรณ์)
// แต่ละ container มี items อยู่ข้างใน

export type ContainerItem = {
  name: string;
  sn: string;    // serial number
  status: string;
};

export type Container = {
  id: string;
  name: string;
  type: string;
  location: string;
  barcode: string;
  items: ContainerItem[];
};

export const initialContainers: Container[] = [
  {
    id: "C1",
    name: "Rack A — Power Amp Rack",
    type: "Rack",
    location: "Zone A1",
    barcode: "RACK-A-001",
    items: [
      { name: "FP10000Q #1", sn: "LG10K-001", status: "Ready" },
      { name: "FP10000Q #2", sn: "LG10K-002", status: "Ready" },
      { name: "FP10000Q #3", sn: "LG10K-003", status: "Ready" },
      { name: "FP10000Q #4", sn: "LG10K-004", status: "Maintenance" },
    ],
  },
  {
    id: "C2",
    name: "Case B — Wireless Mic Kit",
    type: "Case",
    location: "Zone B2",
    barcode: "CASE-B-001",
    items: [
      { name: "Shure ULXD4 Receiver",      sn: "SH-RX-001", status: "Ready" },
      { name: "Shure ULXD2 Handheld #1",   sn: "SH-HH-001", status: "Ready" },
      { name: "Shure ULXD2 Handheld #2",   sn: "SH-HH-002", status: "Ready" },
      { name: "Antenna Combiner",           sn: "SH-AC-001", status: "Ready" },
    ],
  },
  {
    id: "C3",
    name: "Case C — DI Box Set",
    type: "Case",
    location: "Zone C1",
    barcode: "CASE-C-001",
    items: [
      { name: "Radial J48 #1", sn: "RD-J48-001", status: "Ready" },
      { name: "Radial J48 #2", sn: "RD-J48-002", status: "Ready" },
      { name: "Radial J48 #3", sn: "RD-J48-003", status: "Out" },
      { name: "Radial J48 #4", sn: "RD-J48-004", status: "Ready" },
      { name: "Radial J48 #5", sn: "RD-J48-005", status: "Ready" },
      { name: "Radial J48 #6", sn: "RD-J48-006", status: "Ready" },
    ],
  },
];
