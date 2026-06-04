// ห้องเก็บของกลาง (Global State Store)
// ทุก component ในแอปสามารถอ่านและเขียนข้อมูลที่นี่ได้โดยตรง
// โดยไม่ต้องส่ง props ต่อกันเป็นทอดๆ

import { create } from "zustand";
import { initialContainers } from "@/data/containers";
import type { Container } from "@/data/containers";

// กำหนดรูปร่างของ store ทั้งหมด
// แบ่งเป็น 2 ส่วน: ข้อมูล (state) และ actions (ฟังก์ชันแก้ไขข้อมูล)
type AppStore = {
  // ---- Navigation ----
  activePage: string;
  setActivePage: (page: string) => void;

  // ---- Containers ----
  containers: Container[];
  expandedContainers: string[];         // container ไหนเปิดอยู่
  checkedOutContainers: Set<string>;    // container ไหน check out ไปแล้ว
  addContainer: (data: Omit<Container, "id" | "items">) => void;
  toggleContainer: (id: string) => void;
  toggleCheckout: (id: string) => void;
};

// create() สร้าง store — รับ callback ที่ return ข้อมูลและ actions ทั้งหมด
// set() คือฟังก์ชันที่ใช้อัปเดตข้อมูลใน store (เหมือน setState)
// get() คือฟังก์ชันที่ใช้อ่านค่าปัจจุบันจาก store
export const useAppStore = create<AppStore>((set, get) => ({
  // ---- ค่าเริ่มต้น Navigation ----
  activePage: "Home",
  setActivePage: (page) => set({ activePage: page }),

  // ---- ค่าเริ่มต้น Containers ----
  containers: initialContainers,
  expandedContainers: ["C1"],           // เปิด C1 ไว้ตั้งแต่แรก
  checkedOutContainers: new Set(),

  addContainer: (data) => {
    const newContainer: Container = {
      id: `C${Date.now()}`,             // ใช้ timestamp เป็น id ชั่วคราว
      ...data,
      items: [],
    };
    set((state) => ({
      containers: [...state.containers, newContainer],
      expandedContainers: [...state.expandedContainers, newContainer.id],
    }));
  },

  toggleContainer: (id) =>
    set((state) => ({
      expandedContainers: state.expandedContainers.includes(id)
        ? state.expandedContainers.filter((r) => r !== id)
        : [...state.expandedContainers, id],
    })),

  toggleCheckout: (id) =>
    set((state) => {
      const next = new Set(state.checkedOutContainers);
      const isCurrentlyOut = next.has(id);
      if (isCurrentlyOut) next.delete(id);
      else next.add(id);

      return {
        checkedOutContainers: next,
        containers: state.containers.map((c) =>
          c.id !== id
            ? c
            : {
                ...c,
                items: c.items.map((item) => ({
                  ...item,
                  status: isCurrentlyOut ? "Ready" : "Out",
                })),
              }
        ),
      };
    }),
}));
