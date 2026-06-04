// ข้อมูลรายการสินค้า (Stock Items)
// แต่ละ item มี subItems คือ unit ย่อยๆ ของสินค้าชนิดนั้น

export type SubItem = {
  id: number;
  name: string;
  serialNumber: string;
  barcodeNumber: string;
  location: string;
  status: string;
};

export type StockItem = {
  id: number;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  quantity: number;
  expanded: boolean; // เปิด/ปิด row ในตาราง
  subItems: SubItem[];
};

export const stockItems: StockItem[] = [
  {
    id: 1,
    name: "J8 loudspeaker",
    brand: "d&b audiotechnik",
    category: "Speakers",
    subCategory: "Line Array",
    quantity: 24,
    expanded: true,
    subItems: [
      { id: 1, name: "J8 Top1", serialNumber: "Z33057252456", barcodeNumber: "DBJ8-1", location: "Zone A1", status: "Available" },
      { id: 2, name: "J8 Top1", serialNumber: "Z33057252456", barcodeNumber: "DBJ8-1", location: "Zone A1", status: "Available" },
      { id: 3, name: "J8 Top1", serialNumber: "Z33057252456", barcodeNumber: "DBJ8-1", location: "Zone A1", status: "Available" },
      { id: 4, name: "J8 Top1", serialNumber: "Z33057252456", barcodeNumber: "DBJ8-1", location: "Zone A1", status: "Maintenace" },
    ],
  },
  {
    id: 2,
    name: "GSL8 loudspeaker",
    brand: "d&b audiotechnik",
    category: "Speakers",
    subCategory: "Line Array",
    quantity: 10,
    expanded: false,
    subItems: [],
  },
];
