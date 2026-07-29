import { Lock, LockOpen } from "lucide-react";
import { useAppStore } from "@/store/appStore";

// ล็อกป้องกันกดแก้ไข/ลบ/เพิ่มสต็อกผิดพลาดโดยไม่ตั้งใจ — ครอบคลุมทั้งหน้า Stock
// (คลัง/แร็ค/ซ่อมบำรุง/ชุดอุปกรณ์/ขายออก). ปิด (ล็อก) เป็นค่าเริ่มต้นต่อเบราว์เซอร์
// เหมือน theme — ไม่ใช่การตั้งค่าระดับบริษัท. การสแกนเช็คอิน/เช็คเอาท์อุปกรณ์
// (ScanModal) และการ assign/checkout container ไม่ถูกล็อก เพราะเป็นงานปฏิบัติการ
// ประจำวัน ไม่ใช่การแก้ไขข้อมูลสต็อก.
//
// Icon-only by design (no text label, at any width) — it sits in the same flex
// row as the Stock page's <ScrollTabs>, and a labeled pill was crowding 6 tabs
// into scrolling sooner than they need to. .tap-target keeps the mobile hit
// area at 44px without growing the visible icon.
export const StockEditModeToggle = (): JSX.Element => {
  const { stockEditMode, setStockEditMode } = useAppStore();

  return (
    <button
      type="button"
      onClick={() => setStockEditMode(!stockEditMode)}
      aria-label={stockEditMode ? "โหมดแก้ไข: เปิดอยู่ — คลิกเพื่อล็อก" : "โหมดแก้ไข: ล็อกอยู่ — คลิกเพื่อปลดล็อกและแก้ไข/ลบ/เพิ่มสต็อกได้"}
      title={stockEditMode ? "โหมดแก้ไข: เปิดอยู่ — คลิกเพื่อล็อก" : "โหมดแก้ไข: ล็อกอยู่ — คลิกเพื่อปลดล็อกและแก้ไข/ลบ/เพิ่มสต็อกได้"}
      className={`tap-target flex items-center justify-center w-8 h-8 rounded-lg border transition-colors flex-shrink-0 ${
        stockEditMode
          ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20"
          : "bg-fg/[0.06] border-fg/10 text-fg/50 hover:bg-fg/10 hover:text-fg/70"
      }`}
    >
      {stockEditMode ? <LockOpen className="w-3.5 h-3.5" aria-hidden="true" /> : <Lock className="w-3.5 h-3.5" aria-hidden="true" />}
    </button>
  );
};
