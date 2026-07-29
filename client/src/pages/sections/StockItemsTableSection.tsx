import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronRightIcon, Pencil, Trash2, Eye, Package, Loader2, Boxes, Check, X as XIcon, Layers, Plus, Link2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppStore } from "@/store/appStore";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { stockApi } from "@/api";
import type { StockUnitWithPlan, StockItemWithUnits } from "@/api";
import type { StockItem, StockUnit } from "@shared/schema";

type StockItemWithCount = StockItem & { unitCount: number; availableCount: number; plannedCount?: number; sets?: { id: string; name: string }[] };

const AvailabilityBadge = ({ available, total, planned }: { available: number; total: number; planned?: number }) => {
  const { t } = useTranslation("stock");
  const free          = available - (planned ?? 0);
  const allFree       = free === total && total > 0;
  const noneFree      = free === 0 && available === 0;
  const hasPlanned    = (planned ?? 0) > 0;

  const color = allFree && !hasPlanned
    ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
    : noneFree
    ? "bg-red-950/60 text-red-400 border-red-800/40"
    : "bg-amber-950/60 text-amber-400 border-amber-800/40";

  const dot = allFree && !hasPlanned ? "bg-emerald-400" : noneFree ? "bg-red-400" : "bg-amber-400";

  const label = allFree && !hasPlanned
    ? t("allAvailable")
    : noneFree
    ? t("unavailable")
    : t("availableOfTotal", { available: free, total });

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${color}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
        {label}
      </span>
      {hasPlanned && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border bg-blue-950/50 text-blue-300 border-blue-800/40 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
          {planned} จัดเตรียม
        </span>
      )}
    </div>
  );
};

const ActionIcons = ({ onView, onEdit, onAccessories, onDelete }: { onView?: () => void; onEdit?: () => void; onAccessories?: () => void; onDelete?: () => void }) => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  return (
    <div className="flex items-center gap-1">
      <button onClick={(e) => { e.stopPropagation(); onView?.(); }}
        className="p-1.5 rounded-md text-fg/60 hover:text-fg hover:bg-fg/10 transition-colors" title={t("viewDetails")}>
        <Eye className="w-4 h-4" />
      </button>
      {onEdit && (
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded-md text-fg hover:text-brand hover:bg-fg/10 transition-colors" title={tc("edit")}
        >
          <Pencil className="w-4 h-4" />
        </button>
      )}
      {onAccessories && (
        <button onClick={(e) => { e.stopPropagation(); onAccessories(); }}
          className="p-1.5 rounded-md text-fg/60 hover:text-brand hover:bg-fg/10 transition-colors" title={t("tabAccessories")}
        >
          <Link2 className="w-4 h-4" />
        </button>
      )}
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-md text-fg/60 hover:text-red-400 hover:bg-red-400/10 transition-colors" title={tc("delete")}>
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ── Mobile action row: same 4 actions as ActionIcons, but with visible labels and
// 44px targets (icon-only 28px buttons in a 16%-wide column are unusable with a thumb).
const MobileActionRow = ({ onView, onEdit, onAccessories, onDelete }: { onView?: () => void; onEdit?: () => void; onAccessories?: () => void; onDelete?: () => void }) => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const base = "flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-semibold transition-colors flex-shrink-0";
  return (
    <div className="h-scroll flex items-center gap-2">
      <button onClick={(e) => { e.stopPropagation(); onView?.(); }} className={`${base} bg-fg/[0.06] text-fg/70 hover:bg-fg/10`}>
        <Eye className="w-3 h-3" aria-hidden="true" /> {t("viewDetails")}
      </button>
      {onEdit && (
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className={`${base} bg-fg/[0.06] text-fg/70 hover:bg-fg/10`}>
          <Pencil className="w-3 h-3" aria-hidden="true" /> {tc("edit")}
        </button>
      )}
      {onAccessories && (
        <button onClick={(e) => { e.stopPropagation(); onAccessories(); }} className={`${base} bg-fg/[0.06] text-fg/70 hover:bg-fg/10`}>
          <Link2 className="w-3 h-3" aria-hidden="true" /> {t("tabAccessories")}
        </button>
      )}
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className={`${base} bg-red-500/10 text-red-400 hover:bg-red-500/20`}>
          <Trash2 className="w-3 h-3" aria-hidden="true" /> {tc("delete")}
        </button>
      )}
    </div>
  );
};

const toInputDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toISOString().split("T")[0];
};

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

type SaveError = { message: string; duplicateItemId?: string; duplicateItemName?: string };

// checkbox สีเหลืองสไตล์เดียวกับหน้า Maintenance
const YellowCheck = ({ checked, indeterminate, onClick, title }: { checked: boolean; indeterminate?: boolean; onClick: (e: React.MouseEvent) => void; title?: string }) => (
  <button onClick={onClick} title={title}
    className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
      ${checked || indeterminate ? "border-brand bg-brand" : "border-fg/25 hover:border-fg/50"}`}>
    {checked && <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    {!checked && indeterminate && <span className="w-2 h-0.5 bg-black rounded" />}
  </button>
);

// แยกคำนำหน้า + จำนวนหลักของเลขท้ายสตริง เพื่อเดาค่าเริ่มต้นให้ปุ่ม "เติม" อัตโนมัติ
// (เช่น "AMCRON DC-300A Series II #01" → prefix "...II #", pad 2; "AMP-DC-300A-001" → pad 3)
const parseTrailingNumber = (s: string | null | undefined) => {
  const m = (s ?? "").match(/^(.*?)(\d+)$/);
  if (!m) return { prefix: s ?? "", pad: 3 };
  return { prefix: m[1], pad: m[2].length };
};

// Modal แก้ไขหลาย unit พร้อมกัน — ติ๊กช่องที่จะแก้ (ช่องที่ไม่ติ๊ก = ไม่แตะ)
// ชื่อ + บาร์โค้ด แก้แยกทีละหน่วยได้ (ค่าไม่เหมือนกันได้ ต่างจากช่องอื่นที่ apply ค่าเดียวกับทุกหน่วย)
// units ต้องส่งมาตามลำดับที่แสดงในตาราง (ใช้กับปุ่ม "เติม")
const BulkEditUnitsModal = ({ units, onClose, onSaved }: { units: { id: string; name: string; barcode: string | null }[]; onClose: () => void; onSaved: () => void }) => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const { toast } = useToast();
  const unitIds = useMemo(() => units.map((u) => u.id), [units]);
  const [en, setEn] = useState({ location: false, status: false, purchasedAt: false, warrantyExpiresAt: false, nameBarcode: false });
  const [val, setVal] = useState({ location: "", status: "available", purchasedAt: "", warrantyExpiresAt: "" });
  // ชื่อและบาร์โค้ดมักใช้ base + เลขวิ่งเหมือนกัน แค่ pattern คนละแบบ (เช่น "#01" กับ "-001")
  // เดาค่าเริ่มต้นจากหน่วยแรกที่เลือกไว้ให้ — แก้แค่คำนำหน้าตรงนี้ก็พอ ทุกแถวข้างล่างอัปเดตสดตามทันที
  const [fillName, setFillName]       = useState(() => parseTrailingNumber(units[0]?.name));
  const [fillBarcode, setFillBarcode] = useState(() => parseTrailingNumber(units[0]?.barcode));
  const [fillStart, setFillStart]     = useState(() => {
    const m = (units[0]?.name ?? "").match(/(\d+)$/) ?? (units[0]?.barcode ?? "").match(/(\d+)$/);
    return m ? parseInt(m[1], 10) : 1;
  });
  const generatedRows = useMemo(
    () => units.map((u, i) => ({
      id: u.id,
      name:    `${fillName.prefix}${String(fillStart + i).padStart(fillName.pad, "0")}`,
      barcode: `${fillBarcode.prefix}${String(fillStart + i).padStart(fillBarcode.pad, "0")}`,
    })),
    [units, fillName, fillBarcode, fillStart]
  );
  const [rows, setRows] = useState(generatedRows);
  // แก้คำนำหน้า/เลขเริ่ม/จำนวนหลัก → อัปเดตทุกแถวสดทันที ไม่ต้องกดปุ่ม (การแก้ทีละแถวด้วยมือจะถูก
  // เขียนทับถ้าแก้ pattern ซ้ำอีกครั้ง — ตั้งใจ เพราะกรณีใช้งานจริงคือตั้ง pattern ให้ถูกก่อนแล้วค่อย
  // แก้เคสพิเศษทีละแถวเป็นขั้นสุดท้าย)
  useEffect(() => { setRows(generatedRows); }, [generatedRows]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, any> = {};
      if (en.location)          patch.location = val.location || null;
      if (en.status)            patch.status = val.status;
      if (en.purchasedAt)       patch.purchasedAt = val.purchasedAt ? new Date(val.purchasedAt).toISOString() : null;
      if (en.warrantyExpiresAt) patch.warrantyExpiresAt = val.warrantyExpiresAt ? new Date(val.warrantyExpiresAt).toISOString() : null;

      const changedRows = en.nameBarcode
        ? rows.filter((r, i) => r.name !== units[i].name || r.barcode !== (units[i].barcode ?? "")).map((r) => ({ id: r.id, name: r.name, barcode: r.barcode }))
        : [];

      await Promise.all([
        Object.keys(patch).length > 0 ? stockApi.updateUnitsBatch(unitIds, patch) : Promise.resolve(),
        changedRows.length > 0 ? stockApi.updateUnitsValuesBatch(changedRows) : Promise.resolve(),
      ]);
    },
    onSuccess: () => { toast({ title: t("bulkEditDone", { defaultValue: "แก้ไขแล้ว" }), description: `${unitIds.length} ${tc("units")}` }); onSaved(); },
    onError: (err: any) => toast({ title: tc("error"), description: err?.message ?? "", variant: "destructive" }),
  });

  const anyEnabled = en.location || en.status || en.purchasedAt || en.warrantyExpiresAt || en.nameBarcode;
  // ไม่รวม w-full ไว้ในตัวนี้ตั้งใจ — ต้องแปะ "w-full" หรือ "flex-1"/"w-NN" เองต่อจุดใช้งาน
  // เพราะถ้ามีทั้ง w-full กับ w-NN อยู่ในคลาสเดียวกัน Tailwind จะให้ตัวไหนชนะขึ้นกับลำดับใน
  // stylesheet ที่ compile ออกมา ไม่ใช่ลำดับที่เขียนใน className — ผลคือ w-14 อาจแพ้ w-full
  // แบบเงียบๆ (เคยเกิดจริงกับช่อง pad ด้านล่าง ทำให้มันกว้างเบียดช่อง prefix จนแฟบ)
  const inputCls = "h-8 bg-black/50 border border-fg/10 rounded px-2 text-sm text-fg focus:outline-none focus:border-brand/40";
  // เรียกเป็นฟังก์ชัน (ไม่ใช่ <Row/>) — กัน React remount ทำให้ช่องพิมพ์โฟกัสหลุดทุกตัวอักษร
  const row = (k: keyof typeof en, label: string, children: React.ReactNode) => (
    <div className="flex items-center gap-3">
      <YellowCheck checked={en[k]} onClick={() => setEn((p) => ({ ...p, [k]: !p[k] }))} />
      <span className="text-xs text-fg/60 w-28 flex-shrink-0">{label}</span>
      <div className={`flex-1 ${en[k] ? "" : "opacity-40 pointer-events-none"}`}>{children}</div>
    </div>
  );

  // Portal ไปที่ document.body — component นี้ถูก mount อยู่ลึกใน <table>/<tr>/<td> ของ Inventory
  // (ไม่ใช่ Radix Dialog ที่ portal ให้อัตโนมัติ) ถ้าไม่ portal เอง "fixed" จะเทียบกับ containing
  // block ที่ใกล้ที่สุดที่มี transform/animation ของแถวตาราง ไม่ใช่ viewport จริง ทำให้ modal
  // ไปโป่งอยู่ตรงกลางแถวที่กดแทนกลางจอ
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-surface-1 border border-fg/10 rounded-xl shadow-2xl p-5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-1 flex-shrink-0">
          <h3 className="text-base font-bold text-fg">{t("bulkEditTitle", { defaultValue: "แก้ไขหลายหน่วยพร้อมกัน" })}</h3>
          <button onClick={onClose} className="text-fg/50 hover:text-fg"><XIcon className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-fg/50 mb-4 flex-shrink-0">{t("bulkEditHint", { defaultValue: "ติ๊กช่องที่ต้องการเปลี่ยน — เฉพาะช่องที่ติ๊กจะถูกแก้กับทุกหน่วยที่เลือก" })} · {unitIds.length} {tc("units")}</p>
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1">
          {row("location", tc("location"),
            <input className={`${inputCls} w-full`} value={val.location} onChange={(e) => setVal((p) => ({ ...p, location: e.target.value }))} placeholder={tc("location")} />
          )}
          {row("status", tc("status"),
            <select className={`${inputCls} w-full appearance-none cursor-pointer`} value={val.status} onChange={(e) => setVal((p) => ({ ...p, status: e.target.value }))}>
              <option value="available" className="bg-surface-1">{tc("statusEnum.available")}</option>
              <option value="out" className="bg-surface-1">{tc("statusEnum.out")}</option>
              <option value="maintenance" className="bg-surface-1">{tc("statusEnum.maintenance")}</option>
              <option value="retired" className="bg-surface-1">{tc("statusEnum.retired")}</option>
            </select>
          )}
          {row("purchasedAt", t("colPurchased"),
            <input type="date" className={`${inputCls} w-full [color-scheme:dark]`} value={val.purchasedAt} onChange={(e) => setVal((p) => ({ ...p, purchasedAt: e.target.value }))} />
          )}
          {row("warrantyExpiresAt", t("colWarrantyExp"),
            <input type="date" className={`${inputCls} w-full [color-scheme:dark]`} value={val.warrantyExpiresAt} onChange={(e) => setVal((p) => ({ ...p, warrantyExpiresAt: e.target.value }))} />
          )}
          <div className="flex items-start gap-3">
            <YellowCheck checked={en.nameBarcode} onClick={() => setEn((p) => ({ ...p, nameBarcode: !p.nameBarcode }))} />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-fg/60">{t("nameAndBarcodePerUnit", { defaultValue: "ชื่อ & บาร์โค้ด (แก้ทีละหน่วย)" })}</span>
              <div className={`mt-2 flex flex-col gap-2 ${en.nameBarcode ? "" : "opacity-40 pointer-events-none"}`}>
                {/* แก้แค่คำนำหน้า/เลขเริ่ม — ทุกแถวข้างล่างอัปเดตสดทันทีไม่ต้องกดปุ่ม (ชื่อ/บาร์โค้ด
                    คนละ pattern ได้ แต่ใช้เลขวิ่งตัวเดียวกัน) ยังแก้ทีละแถวเป็นกรณีพิเศษต่อได้ */}
                <div className="flex flex-col gap-1 bg-fg/[0.03] rounded-lg p-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-fg/40 w-14 flex-shrink-0">{tc("name")}</span>
                    <input className={`${inputCls} flex-1 min-w-0`} value={fillName.prefix} onChange={(e) => setFillName((p) => ({ ...p, prefix: e.target.value }))} placeholder={t("prefixPlaceholder", { defaultValue: "คำนำหน้า" })} />
                    <input type="number" min={1} max={6} className={`${inputCls} w-14 flex-shrink-0`} value={fillName.pad} onChange={(e) => setFillName((p) => ({ ...p, pad: Math.min(6, Math.max(1, parseInt(e.target.value) || 1)) }))} title={t("padDigitsLabel", { defaultValue: "จำนวนหลัก" })} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-fg/40 w-14 flex-shrink-0">{t("colBarcode")}</span>
                    <input className={`${inputCls} flex-1 min-w-0 font-mono`} value={fillBarcode.prefix} onChange={(e) => setFillBarcode((p) => ({ ...p, prefix: e.target.value }))} placeholder={t("prefixPlaceholder", { defaultValue: "คำนำหน้า" })} />
                    <input type="number" min={1} max={6} className={`${inputCls} w-14 flex-shrink-0`} value={fillBarcode.pad} onChange={(e) => setFillBarcode((p) => ({ ...p, pad: Math.min(6, Math.max(1, parseInt(e.target.value) || 1)) }))} title={t("padDigitsLabel", { defaultValue: "จำนวนหลัก" })} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-fg/40 w-14 flex-shrink-0">{t("startNumberLabel", { defaultValue: "เริ่มที่" })}</span>
                    <input type="number" min={1} className={`${inputCls} w-20 flex-shrink-0`} value={fillStart} onChange={(e) => setFillStart(Math.max(1, parseInt(e.target.value) || 1))} />
                  </div>
                </div>
                {/* รายการทีละหน่วย — พรีวิวสดตามคำนำหน้าด้านบน แก้ทีละแถวเป็นกรณีพิเศษได้ */}
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto border border-fg/[0.06] rounded-lg p-2">
                  {rows.map((r, i) => (
                    <div key={r.id} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-fg/30 w-5 flex-shrink-0 text-right">{i + 1}</span>
                      <input className={`${inputCls} flex-[1.6] min-w-0`} value={r.name} onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder={tc("name")} />
                      <input className={`${inputCls} flex-1 min-w-0 font-mono`} value={r.barcode} onChange={(e) => setRows((p) => p.map((x, j) => j === i ? { ...x, barcode: e.target.value } : x))} placeholder={t("colBarcode")} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 flex-shrink-0">
          <button onClick={onClose} className="h-9 px-4 rounded text-sm text-fg/60 hover:text-fg border border-fg/10">{tc("cancel")}</button>
          <button onClick={() => save.mutate()} disabled={!anyEnabled || save.isPending}
            className="h-9 px-4 rounded text-sm font-bold text-black flex items-center gap-2 disabled:opacity-40" style={{ backgroundColor: "var(--brand)" }}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{tc("save")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const UnitRows = ({ itemId, onViewItem }: { itemId: string; onViewItem?: (item: StockItem) => void }) => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const qc = useQueryClient();
  const { toast } = useToast();
  const { userRole, stockEditMode } = useAppStore();
  const canManage = userRole === "admin" || userRole === "manager";
  // ต้องปลดล็อกโหมดแก้ไข (StockEditModeToggle) ก่อนจึงจะแก้ไข/ลบ/เพิ่มหน่วยได้
  const canEdit = canManage && stockEditMode;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [jumpingToDuplicate, setJumpingToDuplicate] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [deleteUnitId, setDeleteUnitId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addQty, setAddQty] = useState("1");

  const { data, isLoading } = useQuery({
    queryKey: ["stock", itemId],
    queryFn: () => stockApi.getById(itemId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["stock", itemId] });
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["containers"] });
  };

  const deleteUnit = useMutation({
    mutationFn: (id: string) => stockApi.deleteUnit(id),
    onSuccess: () => { invalidate(); setDeleteUnitId(null); setDeleteErr(null); setSelected((p) => { const n = new Set(p); n.delete(deleteUnitId!); return n; }); },
    onError: (err: any) => setDeleteErr(err?.message ?? "ลบไม่สำเร็จ"),
  });

  const deleteBatch = useMutation({
    mutationFn: (ids: string[]) => stockApi.deleteUnitsBatch(ids),
    onSuccess: (res: any) => { invalidate(); setBulkDeleteOpen(false); setDeleteErr(null); setSelected(new Set()); toast({ title: tc("done"), description: `${res?.deleted ?? 0} ${tc("units")}` }); },
    onError: (err: any) => setDeleteErr(err?.message ?? "ลบไม่สำเร็จ"),
  });

  const toggleSel = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // เพิ่มหน่วยให้ของเดิม — รันเลขต่อจากที่มีอยู่ (ชื่อ #NN + บาร์โค้ดต่อชุดเดิม/slug)
  const addUnits = useMutation({
    mutationFn: (n: number) => {
      const cur = (data?.units ?? []) as StockUnitWithPlan[];
      const itemName = data?.name ?? "Unit";
      const nums = cur.map((u) => { const m = (u.name || "").match(/(\d+)\s*$/); return m ? parseInt(m[1]) : 0; });
      const start = (nums.length ? Math.max(...nums) : 0) + 1;
      const withBc = cur.find((u) => u.barcode);
      const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "ITEM";
      const pre = withBc?.barcode ? withBc.barcode.replace(/[-_ ]?\d+\s*$/, "") : slug(itemName);
      const newUnits = Array.from({ length: n }, (_, i) => ({
        name: `${itemName} #${String(start + i).padStart(2, "0")}`,
        serialNumber: null,
        barcode: `${pre}-${String(start + i).padStart(3, "0")}`,
        location: null,
        status: "available",
        purchasedAt: null,
        warrantyExpiresAt: null,
      }));
      return stockApi.addUnitsBatch(itemId, newUnits as Parameters<typeof stockApi.addUnitsBatch>[1]);
    },
    onSuccess: () => { invalidate(); setShowAdd(false); setAddQty("1"); },
    onError: (err: any) => toast({ title: "เพิ่มหน่วยไม่สำเร็จ", description: err?.message ?? "", variant: "destructive" }),
  });

  const updateUnit = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, any> }) =>
      stockApi.updateUnit(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock", itemId] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      setSaveError(null);
      setEditingId(null);
    },
    onError: (err: any) => {
      const msg = err?.message ?? "เกิดข้อผิดพลาด";
      setSaveError({ message: msg, duplicateItemId: err?.duplicateItemId, duplicateItemName: err?.duplicateItemName });
      toast({ title: "ไม่สามารถบันทึกได้", description: msg, variant: "destructive" });
    },
  });

  const jumpToDuplicate = async (id: string) => {
    setJumpingToDuplicate(true);
    try {
      const item = await stockApi.getById(id);
      onViewItem?.(item);
    } finally {
      setJumpingToDuplicate(false);
    }
  };

  const startEdit = (unit: StockUnit) => {
    setEditingId(unit.id);
    setForm({
      name:              unit.name,
      serialNumber:      unit.serialNumber ?? "",
      barcode:           unit.barcode ?? "",
      location:          unit.location ?? "",
      status:            unit.status,
      purchasedAt:       toInputDate((unit as any).purchasedAt),
      warrantyExpiresAt: toInputDate((unit as any).warrantyExpiresAt),
    });
  };

  const saveEdit = (unitId: string) => {
    const toDate = (v: string) => (v ? new Date(v).toISOString() : null);
    updateUnit.mutate({
      id: unitId,
      payload: {
        name:              form.name,
        serialNumber:      form.serialNumber || null,
        barcode:           form.barcode || null,
        location:          form.location || null,
        status:            form.status,
        purchasedAt:       toDate(form.purchasedAt),
        warrantyExpiresAt: toDate(form.warrantyExpiresAt),
      },
    });
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  if (isLoading) {
    return (
      <TableRow className="bg-surface-1 hover:bg-surface-1">
        <TableCell colSpan={6} className="py-3 pl-16">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-fg/60" />
        </TableCell>
      </TableRow>
    );
  }

  const units: StockUnitWithPlan[] = (data?.units ?? []) as StockUnitWithPlan[];

  if (units.length === 0) {
    return (
      <TableRow className="bg-surface-1 hover:bg-surface-1">
        <TableCell colSpan={6} className="py-2.5 pl-16 pr-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-fg/60 italic">{t("noUnitsRow")}</span>
            {canEdit && (showAdd ? (
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={addQty} onChange={(e) => setAddQty(e.target.value)}
                  className="h-7 w-20 bg-black/50 border border-fg/10 rounded px-2 text-sm text-fg text-center focus:outline-none focus:border-brand/40 [color-scheme:dark]" />
                <button onClick={() => addUnits.mutate(Math.max(1, parseInt(addQty) || 1))} disabled={addUnits.isPending}
                  className="h-7 px-3 rounded text-xs font-bold text-black flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: "var(--brand)" }}>
                  {addUnits.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}{tc("add")}
                </button>
                <button onClick={() => setShowAdd(false)} className="h-7 px-3 rounded text-xs text-fg/60 hover:text-fg border border-fg/10">{tc("cancel")}</button>
              </div>
            ) : (
              <button onClick={() => setShowAdd(true)}
                className="h-7 px-3 rounded-lg border border-dashed border-fg/15 hover:border-brand/50 text-fg/50 hover:text-brand text-xs font-medium flex items-center gap-1.5 transition-all">
                <Plus className="w-3.5 h-3.5" />{t("addUnitsToItem", { defaultValue: "เพิ่มหน่วย" })}
              </button>
            ))}
          </div>
        </TableCell>
      </TableRow>
    );
  }

  const inputCls = "h-7 w-full bg-black/50 border border-fg/10 rounded px-2 text-xs text-fg focus:outline-none focus:border-brand/40 transition-colors";
  const allSelected  = units.length > 0 && units.every((u) => selected.has(u.id));
  const someSelected = selected.size > 0 && !allSelected;
  const selectAllToggle = () => setSelected(allSelected ? new Set() : new Set(units.map((u) => u.id)));

  return (
    <>
      {/* Sub-header */}
      <TableRow className="bg-surface-1 hover:bg-surface-1 border-b-0">
        <TableCell colSpan={6} className="py-1.5 pl-16 pr-4">
          <div className="flex items-center gap-2">
            {canEdit && <YellowCheck checked={allSelected} indeterminate={someSelected} onClick={selectAllToggle} title={tc("selectAll")} />}
            <div className="grid gap-x-3 flex-1 text-[10px] font-bold text-fg/60 uppercase tracking-wider pr-[60px]"
              style={{ gridTemplateColumns: "2fr 1.1fr 1.1fr 1fr 1.1fr 1.1fr 1fr" }}>
              <span>{t("colUnitName")}</span>
              <span>{t("colSerialNo")}</span>
              <span>{tc("barcode")}</span>
              <span>{tc("location")}</span>
              <span>{t("colPurchased")}</span>
              <span>{t("colWarrantyExp")}</span>
              <span>{tc("status")}</span>
            </div>
          </div>
        </TableCell>
      </TableRow>

      {/* Bulk action bar */}
      {canEdit && selected.size > 0 && (
        <TableRow className="bg-brand/[0.06] hover:bg-brand/[0.06] border-b border-brand/10">
          <TableCell colSpan={6} className="py-2 pl-16 pr-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-brand font-bold">{t("selectedUnitsCount", { count: selected.size, defaultValue: `เลือก ${selected.size}` })}</span>
              <button onClick={() => setBulkEditOpen(true)}
                className="h-7 px-3 rounded text-xs font-bold text-black flex items-center gap-1.5 hover:opacity-80" style={{ backgroundColor: "var(--brand)" }}>
                <Pencil className="w-3 h-3" />{tc("edit")}
              </button>
              <button onClick={() => { setDeleteErr(null); setBulkDeleteOpen(true); }}
                className="h-7 px-3 rounded text-xs font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 flex items-center gap-1.5">
                <Trash2 className="w-3 h-3" />{tc("delete")}
              </button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-fg/50 hover:text-fg ml-auto">{tc("cancel")}</button>
            </div>
          </TableCell>
        </TableRow>
      )}

      {units.map((unit, i) => {
        const isEditing = editingId === unit.id;
        const wExp      = (unit as any).warrantyExpiresAt as string | null | undefined;
        const wDate     = wExp ? new Date(wExp) : null;
        const expired   = wDate ? wDate.getTime() < Date.now() : false;
        const soon      = wDate ? (!expired && wDate.getTime() - Date.now() < 90 * 864e5) : false;

        return (
          <TableRow
            key={unit.id}
            className={`border-b border-fg/[0.06] transition-colors ${
              isEditing ? "bg-surface-2" : "bg-surface-1 hover:bg-surface-1"
            }`}
            style={{ animationDelay: `${i * 20}ms` }}
          >
            <TableCell colSpan={6} className="py-2 pl-16 pr-4">
              {isEditing ? (
                /* ── Edit mode ── */
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                  {canEdit && <span className="w-4 flex-shrink-0" />}
                  <div className="grid gap-x-3 items-center flex-1"
                    style={{ gridTemplateColumns: "2fr 1.1fr 1.1fr 1fr 1.1fr 1.1fr 1fr" }}>
                    <input className={inputCls} value={form.name}              onChange={f("name")}              placeholder={t("unitNamePlaceholder")} />
                    <input className={`${inputCls} font-mono`} value={form.serialNumber}   onChange={f("serialNumber")}   placeholder={t("serialNoPlaceholder")} />
                    <input className={`${inputCls} font-mono`} value={form.barcode}        onChange={f("barcode")}        placeholder={tc("barcode")} />
                    <input className={inputCls} value={form.location}          onChange={f("location")}          placeholder={tc("location")} />
                    <input type="date" className={`${inputCls} [color-scheme:dark]`} value={form.purchasedAt}  onChange={f("purchasedAt")} />
                    <input type="date" className={`${inputCls} [color-scheme:dark]`} value={form.warrantyExpiresAt} onChange={f("warrantyExpiresAt")} />
                    <select className={`${inputCls} appearance-none cursor-pointer`} value={form.status} onChange={f("status")}>
                      <option value="available"   className="bg-surface-1">{tc("statusEnum.available")}</option>
                      <option value="out"         className="bg-surface-1">{tc("statusEnum.out")}</option>
                      <option value="maintenance" className="bg-surface-1">{tc("statusEnum.maintenance")}</option>
                      <option value="retired"     className="bg-surface-1">{tc("statusEnum.retired")}</option>
                    </select>
                  </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    {saveError && (
                      <span className="text-[11px] text-red-400 flex-1 min-w-0 truncate">
                        {saveError.message}
                        {saveError.duplicateItemId && (
                          <>
                            {" "}
                            <button
                              onClick={() => jumpToDuplicate(saveError.duplicateItemId!)}
                              disabled={jumpingToDuplicate}
                              className="underline hover:text-red-300 disabled:opacity-50 transition-colors"
                            >
                              ({saveError.duplicateItemName ?? t("viewItem")})
                            </button>
                          </>
                        )}
                      </span>
                    )}
                    <button onClick={() => { setEditingId(null); setSaveError(null); }}
                      className="h-7 px-3 rounded text-xs text-fg/60 hover:text-fg border border-fg/10 hover:border-fg/20 transition-colors">
                      {tc("cancel")}
                    </button>
                    <button
                      onClick={() => { setSaveError(null); saveEdit(unit.id); }}
                      disabled={updateUnit.isPending}
                      className="h-7 px-3 rounded text-xs font-bold text-black flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "var(--brand)" }}
                    >
                      {updateUnit.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      {tc("save")}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="flex items-center gap-2">
                  {canEdit && <YellowCheck checked={selected.has(unit.id)} onClick={() => toggleSel(unit.id)} />}
                  <div className="grid gap-x-3 items-center flex-1"
                    style={{ gridTemplateColumns: "2fr 1.1fr 1.1fr 1fr 1.1fr 1.1fr 1fr" }}>
                    <span className="text-fg/85 text-sm font-medium truncate">{unit.name}</span>
                    <span className="text-fg/50 font-mono text-xs truncate">{unit.serialNumber ?? "—"}</span>
                    <span className="text-fg/50 font-mono text-xs truncate">{unit.barcode ?? "—"}</span>
                    <span className="text-fg/50 text-xs truncate">{unit.location ?? "—"}</span>
                    <span className="text-fg/60 text-xs">{fmtDate(wExp ? wExp : null) ? fmtDate((unit as any).purchasedAt) : <span className="text-fg/60">—</span>}</span>
                    <span className={`text-xs ${expired ? "text-red-400 font-semibold" : soon ? "text-amber-400 font-semibold" : "text-fg/60"}`}>
                      {wDate ? (
                        <>{fmtDate(wExp)}{expired && " ⚠"}{soon && " !"}</>
                      ) : <span className="text-fg/60">—</span>}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold w-fit
                        ${unit.status === "available"  ? "bg-emerald-950/60 text-emerald-400" :
                          unit.status === "maintenance" ? "bg-amber-950/60 text-amber-400" :
                          unit.status === "out"         ? "bg-blue-950/60 text-blue-400" :
                          "bg-fg/[0.06] text-fg/60"}`}>
                        <span className={`w-1 h-1 rounded-full ${
                          unit.status === "available"  ? "bg-emerald-400" :
                          unit.status === "maintenance" ? "bg-amber-400" :
                          unit.status === "out"         ? "bg-blue-400" : "bg-fg/30"}`} />
                        {tc(`statusEnum.${unit.status}`, { defaultValue: unit.status }).toUpperCase()}
                      </span>
                      {(unit as StockUnitWithPlan).plannedJob && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold w-fit bg-blue-950/50 text-blue-300 border border-blue-800/30 max-w-[140px]"
                          title={`จัดเตรียมสำหรับ: ${(unit as StockUnitWithPlan).plannedJob!.name}`}>
                          <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                          <span className="truncate">{(unit as StockUnitWithPlan).plannedJob!.name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Edit button */}
                  {stockEditMode && (
                    <button
                      onClick={() => startEdit(unit)}
                      className="flex-shrink-0 p-1.5 rounded text-fg/60 hover:text-brand hover:bg-brand/10 transition-colors"
                      title={t("editUnit")}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => { setDeleteErr(null); setDeleteUnitId(unit.id); }}
                      className="flex-shrink-0 p-1.5 rounded text-fg/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title={t("deleteUnit", { defaultValue: "ลบหน่วยนี้" })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              {!isEditing && (
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-fg/40 pl-0 flex-wrap">
                  <span>{t("addedOn", { date: fmtDate(unit.createdAt) ?? "—" })}</span>
                  {unit.containerName && (
                    <span className="inline-flex items-center gap-1 text-brand/40">
                      <Layers className="w-2.5 h-2.5" /> {t("inContainer", { name: unit.containerName })}
                    </span>
                  )}
                  {(unit as StockUnitWithPlan).plannedJob && (
                    <span className="inline-flex items-center gap-1 text-blue-400/60">
                      <span>→ งาน:</span>
                      <span className="font-medium text-blue-300/70">{(unit as StockUnitWithPlan).plannedJob!.name}</span>
                      {(unit as StockUnitWithPlan).plannedJob!.startDate && (
                        <span className="text-blue-400/40">({fmtDate((unit as StockUnitWithPlan).plannedJob!.startDate)})</span>
                      )}
                    </span>
                  )}
                </div>
              )}
            </TableCell>
          </TableRow>
        );
      })}

      {/* + เพิ่มหน่วยให้ของเดิม (Admin/Manager, ต้องปลดล็อกโหมดแก้ไข) */}
      {canEdit && (
        <TableRow className="bg-surface-1 hover:bg-surface-1 border-b border-fg/[0.03]">
          <TableCell colSpan={6} className="py-2 pl-16 pr-4">
            {showAdd ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-fg/60">{t("addUnitsQtyLabel", { defaultValue: "เพิ่มกี่หน่วย" })}</span>
                <input
                  type="number" min={1} value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="h-7 w-20 bg-black/50 border border-fg/10 rounded px-2 text-sm text-fg text-center focus:outline-none focus:border-brand/40 [color-scheme:dark]"
                />
                <button
                  onClick={() => addUnits.mutate(Math.max(1, parseInt(addQty) || 1))}
                  disabled={addUnits.isPending}
                  className="h-7 px-3 rounded text-xs font-bold text-black flex items-center gap-1.5 disabled:opacity-50" style={{ backgroundColor: "var(--brand)" }}
                >
                  {addUnits.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}{tc("add")}
                </button>
                <button onClick={() => setShowAdd(false)} className="h-7 px-3 rounded text-xs text-fg/60 hover:text-fg border border-fg/10">{tc("cancel")}</button>
              </div>
            ) : (
              <button
                onClick={() => setShowAdd(true)}
                className="w-full h-8 rounded-lg border border-dashed border-fg/15 hover:border-brand/50 text-fg/50 hover:text-brand text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("addUnitsToItem", { defaultValue: "เพิ่มหน่วย" })}
              </button>
            )}
          </TableCell>
        </TableRow>
      )}

      {/* Modals/dialogs — wrapped in a tr/td for valid table DOM; Radix dialogs portal out anyway */}
      {(bulkEditOpen || deleteUnitId || bulkDeleteOpen) && (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={6} className="p-0 border-0">
            {bulkEditOpen && (
              <BulkEditUnitsModal
                units={units.filter((u) => selected.has(u.id)).map((u) => ({ id: u.id, name: u.name, barcode: u.barcode ?? null }))}
                onClose={() => setBulkEditOpen(false)}
                onSaved={() => { setBulkEditOpen(false); invalidate(); setSelected(new Set()); }}
              />
            )}
            <AlertDialog open={!!deleteUnitId} onOpenChange={(open) => { if (!open) { setDeleteUnitId(null); setDeleteErr(null); } }}>
              <AlertDialogContent className="bg-surface-1 border border-fg/[0.08]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-fg">{tc("areYouSure")}</AlertDialogTitle>
                  <AlertDialogDescription className="text-fg/60">
                    {t("deleteUnitConfirm", { defaultValue: "ลบหน่วยนี้ถาวร — ย้อนกลับไม่ได้" })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteErr && <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{deleteErr}</p>}
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-fg/10 text-fg/60 hover:text-fg bg-transparent">{tc("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); if (deleteUnitId) deleteUnit.mutate(deleteUnitId); }}
                    disabled={deleteUnit.isPending}
                    className="bg-red-600 hover:bg-red-700 text-fg border-0"
                  >
                    {deleteUnit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : tc("delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={bulkDeleteOpen} onOpenChange={(open) => { if (!open) { setBulkDeleteOpen(false); setDeleteErr(null); } }}>
              <AlertDialogContent className="bg-surface-1 border border-fg/[0.08]">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-fg">{t("deleteUnitsTitle", { count: selected.size, defaultValue: `ลบ ${selected.size} หน่วย?` })}</AlertDialogTitle>
                  <AlertDialogDescription className="text-fg/60">
                    {t("deleteUnitConfirm", { defaultValue: "ลบหน่วยที่เลือกถาวร — ย้อนกลับไม่ได้" })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteErr && <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{deleteErr}</p>}
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-fg/10 text-fg/60 hover:text-fg bg-transparent">{tc("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); deleteBatch.mutate(Array.from(selected)); }}
                    disabled={deleteBatch.isPending}
                    className="bg-red-600 hover:bg-red-700 text-fg border-0"
                  >
                    {deleteBatch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : tc("delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

interface StockItemsTableProps {
  selectedBrands?: string[];
  selectedCategories?: string[];
  selectedSubCategories?: string[];
  searchQuery?: string;
  onViewItem?: (item: StockItem) => void;
  onEditItem?: (item: StockItem) => void;
  onManageAccessories?: (item: StockItem) => void;
  selectedItemId?: string | null;
}

export const StockItemsTableSection = ({
  selectedBrands = [],
  selectedCategories = [],
  selectedSubCategories = [],
  searchQuery = "",
  onViewItem,
  onEditItem,
  onManageAccessories,
  selectedItemId,
}: StockItemsTableProps): JSX.Element => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const { token, userRole, stockEditMode } = useAppStore();
  const qc = useQueryClient();
  const [expandedRows, setExpandedRows]           = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [deleteItemId, setDeleteItemId]           = useState<string | null>(null);
  const [deleteError, setDeleteError]             = useState<string | null>(null);

  const canManage = userRole === "admin" || userRole === "manager";
  // ต้องปลดล็อกโหมดแก้ไข (StockEditModeToggle) ก่อนจึงจะแก้ไข/ลบ/เพิ่มอุปกรณ์ได้ — กันกดผิด
  const canEdit = canManage && stockEditMode;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => stockApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      setDeleteItemId(null);
    },
    onError: (err: any) => {
      setDeleteError(err.message ?? "ไม่สามารถลบได้");
    },
  });

  const { data: stockItems = [], isLoading } = useQuery<StockItemWithCount[]>({
    queryKey: ["stock"],
    queryFn: stockApi.getAll as () => Promise<StockItemWithCount[]>,
    enabled: !!token,
  });

  // ใช้เฉพาะหา stockItemId ที่มี unit ตรงกับ serial/barcode ที่ค้นหา (ไม่ใช้ render หลัก — badge/count ยังมาจาก ["stock"] เดิม)
  const { data: stockGroupsForSearch = [] } = useQuery<StockItemWithUnits[]>({
    queryKey: ["stock-with-units"],
    queryFn: stockApi.getAllWithUnits,
    enabled: !!token && searchQuery.trim().length > 0,
  });

  const serialBarcodeMatchIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return new Set<string>();
    const ids = new Set<string>();
    for (const g of stockGroupsForSearch) {
      if (g.units.some((u) => (u.serialNumber ?? "").toLowerCase().includes(q) || (u.barcode ?? "").toLowerCase().includes(q))) {
        ids.add(g.id);
      }
    }
    return ids;
  }, [stockGroupsForSearch, searchQuery]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const isFiltering = searchQuery || selectedBrands.length > 0 || selectedCategories.length > 0 || selectedSubCategories.length > 0;

  const filteredItems = useMemo(() =>
    stockItems
      .filter((item) => {
        const brandMatch       = selectedBrands.length === 0       || selectedBrands.includes(item.brand);
        const categoryMatch    = selectedCategories.length === 0    || selectedCategories.includes(item.category);
        const subCategoryMatch = selectedSubCategories.length === 0 || selectedSubCategories.includes(item.subCategory);
        const q = searchQuery.toLowerCase();
        const searchMatch =
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.brand.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.subCategory.toLowerCase().includes(q) ||
          serialBarcodeMatchIds.has(item.id);
        return brandMatch && categoryMatch && subCategoryMatch && searchMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    [stockItems, selectedBrands, selectedCategories, selectedSubCategories, searchQuery, serialBarcodeMatchIds]
  );

  // Group by category, sorted A→Z
  const grouped = useMemo(() => {
    const map = new Map<string, StockItemWithCount[]>();
    for (const item of filteredItems) {
      const cat = item.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  // count pieces: bulk items count their quantity, unit items count their units
  const pieceCount = (i: StockItemWithCount) => i.trackingMode === "bulk" ? (i.quantity ?? 0) : i.unitCount;
  const totalItems = filteredItems.length;
  const totalUnits = filteredItems.reduce((s, i) => s + pieceCount(i), 0);

  // When filtering/searching, treat all categories as expanded
  const isCategoryOpen = (cat: string) => isFiltering ? true : expandedCategories.has(cat);

  // ── Mobile: category accordion → model cards (see SKILL.md §5/P4).
  // The desktop <table> is squeezed to ~50px per column at 360px, which is why the
  // presentation changes shape entirely here rather than just shrinking.
  const mobileCards = (
    <div className="flex flex-col gap-2 p-2.5">
      {isLoading && Array.from({ length: 5 }).map((_, i) => (
        <div key={`mskel-${i}`} className="animate-pulse bg-surface-2 border border-fg/[0.06] rounded-xl h-24" />
      ))}

      {!isLoading && grouped.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16">
          <Package className="w-8 h-8 text-fg/40" aria-hidden="true" />
          <p className="text-fg/60 text-sm">{t("noItemsMatchFilters")}</p>
        </div>
      )}

      {!isLoading && grouped.map(([category, items]) => {
        const catOpen = isCategoryOpen(category);
        const catTotalUnits = items.reduce((s: number, i: StockItemWithCount) => s + pieceCount(i), 0);
        const catAvail = items.reduce((s: number, i: StockItemWithCount) => s + i.availableCount, 0);
        const allAvail = catAvail === catTotalUnits && catTotalUnits > 0;
        const noneAvail = catAvail === 0;

        return (
          <div key={`m-${category}`} className="rounded-xl border border-fg/10 bg-surface-1 overflow-hidden">
            <button
              onClick={() => !isFiltering && toggleCategory(category)}
              className="w-full text-left px-2.5 py-2.5 flex items-center gap-2 min-h-[46px] hover:bg-surface-2 transition-colors"
            >
              {!isFiltering && (
                <ChevronRightIcon className={`w-3.5 h-3.5 flex-shrink-0 text-brand/60 transition-transform duration-200 ${catOpen ? "rotate-90" : ""}`} aria-hidden="true" />
              )}
              <Boxes className="w-3.5 h-3.5 text-brand/40 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[13px] text-brand truncate">{category}</div>
                <div className="text-[10px] text-fg/50 mt-0.5">
                  {t("modelsCount", { count: items.length })} · {t("unitsCount", { count: catTotalUnits })}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0
                ${allAvail ? "bg-emerald-950/40 text-emerald-500" : noneAvail ? "bg-red-950/40 text-red-500" : "bg-amber-950/40 text-amber-500"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${allAvail ? "bg-emerald-500" : noneAvail ? "bg-red-500" : "bg-amber-500"}`} />
                {allAvail ? t("allAvailable") : noneAvail ? t("noneAvailable") : catAvail}
              </span>
            </button>

            {catOpen && (
              <div className="flex flex-col gap-1.5 px-2 pb-2">
                {items.map((item: StockItemWithCount) => {
                  const isBulk = item.trackingMode === "bulk";
                  const isExpanded = !isBulk && expandedRows.has(item.id);
                  const totalForBadge = isBulk ? (item.quantity ?? 0) : item.unitCount;
                  return (
                    <div
                      key={`m-${item.id}`}
                      className={`rounded-lg border ${isBulk ? "border-amber-400/25 bg-amber-500/[0.05]" : "border-fg/[0.08] bg-surface-2"}`}
                    >
                      <button
                        onClick={isBulk ? undefined : () => toggleRow(item.id)}
                        className={`w-full text-left px-2.5 py-2.5 flex items-start gap-2 ${isBulk ? "cursor-default" : ""}`}
                      >
                        {isBulk ? (
                          <span className="w-4 h-4 mt-0.5 rounded-md bg-amber-400/15 flex items-center justify-center flex-shrink-0">
                            <Layers className="w-2.5 h-2.5 text-amber-400" aria-hidden="true" />
                          </span>
                        ) : (
                          <ChevronRightIcon className={`w-3.5 h-3.5 mt-1 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90 text-brand" : "text-fg/50"}`} aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className={`font-semibold text-[13px] leading-snug break-words ${isBulk ? "text-amber-100/90" : "text-fg/90"}`}>
                            {item.name}
                          </div>
                          <div className="text-[10px] text-fg/50 mt-0.5 truncate">
                            {item.brand}{item.subCategory ? ` · ${item.subCategory}` : ""}
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isBulk ? "bg-amber-400/15 text-amber-300" : "bg-fg/[0.08] text-fg/70"}`}>
                              {totalForBadge} {isBulk ? "ชิ้น" : t("unitsCount", { count: totalForBadge }).replace(String(totalForBadge), "").trim()}
                            </span>
                            <AvailabilityBadge available={item.availableCount} total={totalForBadge} planned={item.plannedCount} />
                          </div>
                          {item.sets && item.sets.length > 0 && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand/90 font-semibold max-w-full">
                              <Boxes className="w-2.5 h-2.5 flex-shrink-0" aria-hidden="true" />
                              <span className="truncate">{item.sets[0].name}{item.sets.length > 1 ? ` +${item.sets.length - 1}` : ""}</span>
                            </div>
                          )}
                        </div>
                      </button>

                      <div className="px-2.5 pb-2 pt-1 border-t border-fg/[0.06]">
                        <MobileActionRow
                          onView={() => onViewItem?.(item)}
                          onEdit={stockEditMode ? () => onEditItem?.(item) : undefined}
                          onAccessories={stockEditMode ? () => onManageAccessories?.(item) : undefined}
                          onDelete={canEdit ? () => { setDeleteError(null); setDeleteItemId(item.id); } : undefined}
                        />
                      </div>

                      {/* Unit list reuses UnitRows verbatim (all edit/bulk/delete behaviour
                          preserved) inside its own horizontal scroller. */}
                      {isExpanded && (
                        <div className="h-scroll border-t border-fg/[0.06]">
                          <table className="w-full text-sm min-w-[760px]">
                            <tbody>
                              <UnitRows itemId={item.id} onViewItem={onViewItem} />
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const desktopTable = (
      <div className="overflow-x-auto">
        <Table className="w-full min-w-[900px]">
          {/* No table-fixed + percentage colgroup here: that combination meant the table
              could never exceed 100% width, so the overflow-x-auto wrapper never activated
              and columns just crushed instead (SKILL.md R10). min-w-[900px] + auto layout
              makes the wrapper actually scroll. */}
          <TableHeader>
            <TableRow className="border-fg/10 hover:bg-transparent">
              <TableHead className="py-3 pl-6 font-bold text-brand text-xs uppercase tracking-wider">{tc("name")}</TableHead>
              <TableHead className="py-3 font-bold text-brand text-xs uppercase tracking-wider">{tc("brand")}</TableHead>
              <TableHead className="py-3 font-bold text-brand text-xs uppercase tracking-wider">{t("colSubCategory")}</TableHead>
              <TableHead className="py-3 font-bold text-brand text-xs uppercase tracking-wider">{t("colQty")}</TableHead>
              <TableHead className="py-3 font-bold text-brand text-xs uppercase tracking-wider">{tc("status")}</TableHead>
              <TableHead className="py-3 pr-6 text-right font-bold text-brand text-xs uppercase tracking-wider">{tc("actions")}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* ─── Skeleton ─── */}
            {isLoading && Array.from({ length: 4 }).map((_, ci) => (
              <React.Fragment key={`skg-${ci}`}>
                {/* category header skeleton */}
                <TableRow className="animate-pulse bg-surface-1 border-b border-fg/[0.08]">
                  <TableCell colSpan={6} className="py-3 pl-4">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-fg/[0.08]" />
                      <div className="h-3.5 rounded bg-fg/[0.08] w-32" />
                      <div className="h-5 rounded-full bg-fg/[0.05] w-20 ml-2" />
                    </div>
                  </TableCell>
                </TableRow>
                {/* item skeletons inside */}
                {Array.from({ length: 3 }).map((_, ii) => (
                  <TableRow key={`ski-${ci}-${ii}`} className="animate-pulse bg-surface-2 border-b border-fg/[0.05]">
                    <TableCell className="py-3 pl-10">
                      <div className="h-3 rounded bg-fg/[0.06]" style={{ width: `${50 + (ii * 19) % 40}%` }} />
                    </TableCell>
                    <TableCell><div className="h-3 rounded bg-fg/[0.04] w-20" /></TableCell>
                    <TableCell><div className="h-3 rounded bg-fg/[0.04] w-16" /></TableCell>
                    <TableCell><div className="h-3 rounded bg-fg/[0.04] w-6" /></TableCell>
                    <TableCell><div className="h-5 rounded-full bg-fg/[0.04] w-24" /></TableCell>
                    <TableCell />
                  </TableRow>
                ))}
              </React.Fragment>
            ))}

            {/* ─── Empty state ─── */}
            {!isLoading && grouped.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="w-8 h-8 text-fg/40" />
                    <p className="text-fg/60 text-sm">{t("noItemsMatchFilters")}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* ─── Grouped rows ─── */}
            {!isLoading && grouped.map(([category, items]) => {
              const catOpen       = isCategoryOpen(category);
              const catTotalUnits = items.reduce((s: number, i: StockItemWithCount) => s + pieceCount(i), 0);
              const catAvail      = items.reduce((s: number, i: StockItemWithCount) => s + i.availableCount, 0);
              const allAvail      = catAvail === catTotalUnits && catTotalUnits > 0;
              const noneAvail     = catAvail === 0;

              return (
                <React.Fragment key={category}>
                  {/* Category header */}
                  <TableRow
                    className="cursor-pointer bg-surface-1 hover:bg-surface-2 border-b border-fg/[0.08] transition-colors select-none"
                    onClick={() => !isFiltering && toggleCategory(category)}
                  >
                    <TableCell colSpan={6} className="py-2.5 pl-4 pr-6">
                      <div className="flex items-center gap-2.5">
                        {!isFiltering && (
                          <ChevronRightIcon
                            className={`w-4 h-4 flex-shrink-0 text-brand/60 transition-transform duration-200 ${catOpen ? "rotate-90" : ""}`}
                          />
                        )}
                        <Boxes className="w-3.5 h-3.5 text-brand/40 flex-shrink-0" />
                        <span className="font-bold text-sm text-brand">{category}</span>
                        <span className="text-xs text-fg/60 ml-1">
                          {t("modelsCount", { count: items.length })} · {t("unitsCount", { count: catTotalUnits })}
                        </span>
                        <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                          ${allAvail  ? "bg-emerald-950/40 text-emerald-500" :
                            noneAvail ? "bg-red-950/40 text-red-500" :
                            "bg-amber-950/40 text-amber-500"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${allAvail ? "bg-emerald-500" : noneAvail ? "bg-red-500" : "bg-amber-500"}`} />
                          {allAvail ? t("allAvailable") : noneAvail ? t("noneAvailable") : t("countAvailable", { count: catAvail })}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Item rows (shown when category is open) */}
                  {catOpen && items.map((item: StockItemWithCount) => {
                    const isBulk     = item.trackingMode === "bulk";
                    const isExpanded = !isBulk && expandedRows.has(item.id);
                    const isSelected = selectedItemId === item.id;
                    const totalForBadge = isBulk ? (item.quantity ?? 0) : item.unitCount;
                    return (
                      <React.Fragment key={item.id}>
                        <TableRow
                          className={`transition-colors border-b ${
                            isBulk ? "" : "cursor-pointer"
                          } ${
                            isSelected
                              ? "bg-brand/[0.05] border-l-2 border-l-brand/50 border-b-fg/10"
                              : isBulk
                              ? "bg-amber-500/[0.05] hover:bg-amber-500/[0.09] border-l-2 border-l-amber-400/50 border-b-amber-400/20"
                              : "bg-surface-2 hover:bg-surface-2 border-b-fg/10"
                          }`}
                          onClick={isBulk ? undefined : () => toggleRow(item.id)}
                        >
                          <TableCell className="py-2.5 pl-10">
                            <div className="flex items-center gap-2">
                              {isBulk ? (
                                <span className="w-5 h-5 rounded-md bg-amber-400/15 flex items-center justify-center flex-shrink-0">
                                  <Layers className="w-3 h-3 text-amber-400" />
                                </span>
                              ) : (
                                <ChevronRightIcon
                                  className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                                    isExpanded ? "rotate-90 text-brand" : "text-fg/60"
                                  }`}
                                />
                              )}
                              <span className={`font-medium text-sm truncate ${isBulk ? "text-amber-100/90" : isSelected ? "text-brand" : "text-fg/90"}`}>
                                {item.name}
                              </span>
                              {isBulk && (
                                <span className="ml-1 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 font-bold flex-shrink-0 uppercase tracking-wide">
                                  นับจำนวน
                                </span>
                              )}
                              {item.sets && item.sets.length > 0 && (
                                <span
                                  className="ml-1 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand/90 font-semibold flex-shrink-0 max-w-[220px]"
                                  title={`อยู่ในชุด: ${item.sets.map((s) => s.name).join(", ")}`}
                                >
                                  <Boxes className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span className="truncate">{item.sets[0].name}{item.sets.length > 1 ? ` +${item.sets.length - 1}` : ""}</span>
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-fg/60 text-sm truncate align-middle">
                            {item.brand}
                          </TableCell>
                          <TableCell className="py-2.5 text-fg/60 text-sm truncate align-middle">
                            {item.subCategory || "—"}
                          </TableCell>
                          <TableCell className="py-2.5 text-sm align-middle">
                            {isBulk ? (
                              <span className="font-bold text-amber-400">{totalForBadge}<span className="ml-0.5 text-[10px] font-normal text-amber-400/60">ชิ้น</span></span>
                            ) : (
                              <span className="font-bold text-fg/80">{totalForBadge}</span>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5 align-middle">
                            <AvailabilityBadge available={item.availableCount} total={totalForBadge} planned={item.plannedCount} />
                          </TableCell>
                          <TableCell className="py-2.5 pr-6 text-right align-middle">
                            <ActionIcons
                              onView={() => onViewItem?.(item)}
                              onEdit={stockEditMode ? () => onEditItem?.(item) : undefined}
                              onAccessories={stockEditMode ? () => onManageAccessories?.(item) : undefined}
                              onDelete={canEdit ? () => { setDeleteError(null); setDeleteItemId(item.id); } : undefined}
                            />
                          </TableCell>
                        </TableRow>
                        {isExpanded && <UnitRows key={`units-${item.id}`} itemId={item.id} onViewItem={onViewItem} />}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
  );

  return (
    <section className="w-full bg-surface-1 rounded-xl border border-fg/10 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-2.5 md:px-6 py-2.5 md:py-4 border-b border-fg/10 flex items-center gap-2 md:gap-3">
        <Package className="w-4 h-4 md:w-5 md:h-5 text-brand flex-shrink-0" aria-hidden="true" />
        <h2 className="font-bold text-brand text-[13px] md:text-base tracking-widest uppercase truncate">{t("stockItems")}</h2>
        <div className="ml-auto flex items-center gap-1.5 md:gap-3 text-[10px] md:text-xs text-fg/60 font-medium flex-shrink-0">
          {isFiltering && <span className="text-brand/50 hidden sm:inline">{t("filteredLabel")} ·</span>}
          <span>{t("categoryCount", { count: grouped.length })}</span>
          <span className="text-fg/40">·</span>
          <span>{t("modelsCount", { count: totalItems })}</span>
          <span className="text-fg/40 hidden sm:inline">·</span>
          <span className="hidden sm:inline">{t("unitsCount", { count: totalUnits })}</span>
        </div>
      </div>

      <ResponsiveTable table={desktopTable} cards={mobileCards} />

      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => { if (!open) { setDeleteItemId(null); setDeleteError(null); } }}>
        <AlertDialogContent className="bg-surface-1 border border-fg/[0.08]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-fg">{tc("areYouSure")}</AlertDialogTitle>
            <AlertDialogDescription className="text-fg/60">
              {t("deleteItemConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="border-fg/10 text-fg/60 hover:text-fg bg-transparent">
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (deleteItemId) deleteMutation.mutate(deleteItemId); }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-fg border-0"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};
