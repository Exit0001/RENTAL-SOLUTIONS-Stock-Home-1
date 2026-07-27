import { useState, useMemo } from "react";
import { Plus, Trash2, Zap, Search, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { catalogApi } from "@/api";
import { WorkspaceShell, WSButton } from "@/components/WorkspaceShell";
import type { Brand, Category, SubCategory } from "@shared/schema";

type UnitDraft = { serial: string; barcode: string; purchasedAt: string; warrantyExpiresAt: string };
type TrackingMode = "unit" | "bulk";
type Row = {
  id: number;
  brand: string; category: string; subCategory: string;
  name: string; qty: string;
  purchaseCost: string; dailyRate: string;
  open: boolean; units: UnitDraft[];
};

export interface QuickAddPayload {
  trackingMode: TrackingMode;
  // shared (ใช้กับทุกรายการ)
  manufacturer: string;
  manufacturerCountry: string;
  location: string;
  rows: {
    brand: string; category: string; subCategory: string;
    name: string; qty: number;
    purchaseCost: string; dailyRate: string;
    units?: { serial: string | null; barcode: string | null; purchasedAt: string | null; warrantyExpiresAt: string | null }[];
  }[];
}

const slugify = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "ITEM";
const emptyUnit = (): UnitDraft => ({ serial: "", barcode: "", purchasedAt: "", warrantyExpiresAt: "" });

// select ที่พิมพ์ค้นหาได้
const Combo = ({
  value, onChange, options, placeholder, disabled, disabledHint, compact,
}: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder: string; disabled?: boolean; disabledHint?: string; compact?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = query.trim() ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : options;
  const h = compact ? "h-8 text-xs" : "h-9 text-sm";
  return (
    <div className="relative">
      {open && !disabled && <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg/60 pointer-events-none" />}
      <input
        value={open ? query : value}
        onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onFocus={() => { if (!disabled) { setOpen(true); setQuery(""); } }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
        placeholder={disabled ? disabledHint : (value || placeholder)}
        className={`w-full ${h} bg-black/40 border border-fg/10 rounded-lg text-fg placeholder:text-fg/40
          focus:outline-none focus:border-brand/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${open && !disabled ? "pl-8 pr-7" : "px-2.5 pr-7"}`}
      />
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg/40 pointer-events-none" />
      {open && !disabled && (
        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-surface-1 border border-fg/10 rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-fg/50 italic">—</div>
          ) : filtered.map((o) => (
            <button key={o} onMouseDown={() => { onChange(o); setQuery(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${o === value ? "text-brand bg-brand/10" : "text-fg/70 hover:bg-brand/10 hover:text-brand"}`}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Field = ({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-[10px] text-fg/50 uppercase tracking-wider">{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className={`h-8 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg px-2.5 placeholder:text-fg/40 focus:outline-none focus:border-brand/40 transition-colors ${type === "date" ? "[color-scheme:dark]" : ""}`} />
  </div>
);

interface Props {
  onClose: () => void;
  onSubmit: (payload: QuickAddPayload) => void;
  isPending?: boolean;
}

export const QuickAddItemsModal = ({ onClose, onSubmit, isPending }: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();

  const { data: brands = [] } = useQuery({ queryKey: ["catalog", "brands"], queryFn: catalogApi.getBrands, enabled: !!token });
  const { data: categories = [] } = useQuery({ queryKey: ["catalog", "categories"], queryFn: catalogApi.getCategories, enabled: !!token });
  const { data: subCategories = [] } = useQuery({ queryKey: ["catalog", "subcategories"], queryFn: catalogApi.getSubCategories, enabled: !!token });

  const brandOptions = useMemo(() => [...brands].sort((a: Brand, b: Brand) => a.name.localeCompare(b.name)).map((b) => b.name), [brands]);
  const categoryOptions = useMemo(() => [...categories].sort((a: Category, b: Category) => a.name.localeCompare(b.name)).map((c) => c.name), [categories]);
  const subsFor = (cat: string) => cat ? (subCategories as SubCategory[]).filter((s) => s.parentCategory === cat).map((s) => s.name) : [];

  // ค่าเริ่มต้น (เติมให้แถวใหม่ + ตามให้แถวที่ยังไม่ถูกแก้)
  const [defBrand, setDefBrand] = useState("");
  const [defCategory, setDefCategory] = useState("");
  const [defSub, setDefSub] = useState("");
  const [mode, setMode] = useState<TrackingMode>("unit");
  const [manufacturer, setManufacturer] = useState("");
  const [country, setCountry] = useState("");
  const [location, setLocation] = useState("");

  const [rows, setRows] = useState<Row[]>([{ id: 1, brand: "", category: "", subCategory: "", name: "", qty: "1", purchaseCost: "", dailyRate: "", open: false, units: [] }]);

  // เปลี่ยนค่าเริ่มต้น → ตามให้แถวที่ยังว่างหรือยังใช้ค่าเดิม (ไม่แตะแถวที่ผู้ใช้ตั้งเอง)
  const changeDefBrand = (v: string) => {
    setRows((r) => r.map((x) => (!x.brand || x.brand === defBrand) ? { ...x, brand: v } : x));
    setDefBrand(v);
  };
  const changeDefCategory = (v: string) => {
    setRows((r) => r.map((x) => {
      if (!(!x.category || x.category === defCategory)) return x;
      return { ...x, category: v, subCategory: subsFor(v).includes(x.subCategory) ? x.subCategory : "" };
    }));
    if (!subsFor(v).includes(defSub)) setDefSub("");
    setDefCategory(v);
  };
  const changeDefSub = (v: string) => {
    setRows((r) => r.map((x) => (!x.subCategory || x.subCategory === defSub) ? { ...x, subCategory: v } : x));
    setDefSub(v);
  };

  const mkRow = (id: number): Row => ({ id, brand: defBrand, category: defCategory, subCategory: defSub, name: "", qty: "1", purchaseCost: "", dailyRate: "", open: false, units: [] });
  const addRow = () => setRows((r) => [...r, mkRow(Date.now())]);
  const removeRow = (id: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  const setField = (id: number, key: "brand" | "name" | "qty" | "purchaseCost" | "dailyRate" | "subCategory", v: string) =>
    setRows((r) => r.map((x) => x.id === id ? { ...x, [key]: v } : x));
  const setRowCategory = (id: number, v: string) =>
    setRows((r) => r.map((x) => x.id === id ? { ...x, category: v, subCategory: subsFor(v).includes(x.subCategory) ? x.subCategory : "" } : x));
  const toggleOpen = (id: number) => setRows((r) => r.map((x) => {
    if (x.id !== id) return x;
    const n = Math.max(0, parseInt(x.qty) || 0);
    return { ...x, open: !x.open, units: Array.from({ length: n }, (_, i) => x.units[i] ?? emptyUnit()) };
  }));
  const setUnit = (rowId: number, idx: number, key: keyof UnitDraft, v: string) => setRows((r) => r.map((x) => {
    if (x.id !== rowId) return x;
    const units = x.units.slice();
    units[idx] = { ...(units[idx] ?? emptyUnit()), [key]: v };
    return { ...x, units };
  }));

  const qtyOf = (r: Row) => Math.max(0, parseInt(r.qty) || 0);
  const validRows = rows.filter((r) => r.name.trim() && r.brand && r.category);
  const totalModels = validRows.length;
  const totalUnits = validRows.reduce((s, r) => s + qtyOf(r), 0);
  const canSave = totalModels > 0 && !isPending;
  const unitLabel = mode === "bulk" ? t("quickAdd.pieces", { defaultValue: "ชิ้น" }) : tc("units");

  const submit = () => {
    if (!canSave) return;
    onSubmit({
      trackingMode: mode,
      manufacturer, manufacturerCountry: country, location,
      rows: validRows.map((r) => {
        const q = qtyOf(r);
        return {
          brand: r.brand, category: r.category, subCategory: r.subCategory,
          name: r.name.trim(), qty: q,
          purchaseCost: r.purchaseCost, dailyRate: r.dailyRate,
          units: mode === "unit"
            ? Array.from({ length: q }, (_, i) => ({
                serial: r.units[i]?.serial?.trim() || null,
                barcode: r.units[i]?.barcode?.trim() || null,
                purchasedAt: r.units[i]?.purchasedAt || null,
                warrantyExpiresAt: r.units[i]?.warrantyExpiresAt || null,
              }))
            : undefined,
        };
      }),
    });
  };

  const labelCls = "text-[10px] text-fg/50 uppercase tracking-wider font-medium";

  return (
    <WorkspaceShell
      icon={<Zap className="w-4 h-4 text-black" />}
      title={t("quickAdd.title", { defaultValue: "เพิ่มสินค้า" })}
      subtitle={t("quickAdd.subtitle", { defaultValue: "เพิ่มหลายรายการในหน้าเดียว — คนละแบรนด์/หมวดได้" })}
      onClose={onClose}
      sidebarTitle={t("quickAdd.defaults", { defaultValue: "ค่าเริ่มต้น (ปรับรายรุ่นได้)" })}
      sidebar={
        <div className="p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>{tc("brand")}</label>
              <Combo value={defBrand} onChange={changeDefBrand} options={brandOptions} placeholder={tc("selectPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>{tc("category")}</label>
              <Combo value={defCategory} onChange={changeDefCategory} options={categoryOptions} placeholder={tc("selectPlaceholder")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>{tc("subCategory")}</label>
              <Combo value={defSub} onChange={changeDefSub} options={subsFor(defCategory)}
                placeholder={tc("selectPlaceholder")} disabled={!defCategory}
                disabledHint={t("addNewItem.selectCategoryFirst", { defaultValue: "เลือกหมวดหมู่ก่อน" })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>{t("addNewItem.trackingModeLabel", { defaultValue: "โหมดการติดตาม" })}</label>
              <div className="flex gap-1">
                {([["unit", t("addNewItem.trackingModeUnit", { defaultValue: "รายชิ้น" })], ["bulk", t("addNewItem.trackingModeBulk", { defaultValue: "จำนวน (Bulk)" })]] as const).map(([m, label]) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 h-8 rounded-lg text-xs font-bold transition-colors ${mode === m ? "bg-brand text-black" : "bg-fg/5 text-fg/60 hover:text-fg"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-px bg-fg/[0.06] my-1" />
            <p className="text-[10px] text-fg/40">{t("quickAdd.sharedInfo", { defaultValue: "ข้อมูลร่วม (ใช้กับทุกรายการ)" })}</p>
            <Field label={t("addNewItem.manufacturerLabel", { defaultValue: "ผู้ผลิต" })} value={manufacturer} onChange={setManufacturer} />
            <Field label={t("addNewItem.manufacturerCountry", { defaultValue: "ประเทศผู้ผลิต" })} value={country} onChange={setCountry} />
            <Field label={tc("location")} value={location} onChange={setLocation} />
        </div>
      }
      footer={
        <>
          <div className="text-sm text-fg/70 font-medium">
            {t("quickAdd.summary", { defaultValue: "รวม {{models}} รุ่น · {{units}} {{unit}}", models: totalModels, units: totalUnits, unit: unitLabel })}
          </div>
          <div className="flex items-center gap-2">
            <WSButton variant="ghost" onClick={onClose}>{tc("cancel")}</WSButton>
            <WSButton variant="primary" onClick={submit} disabled={!canSave} pending={isPending} icon={<Zap className="w-4 h-4" />}>
              {t("quickAdd.saveAll", { defaultValue: "บันทึกทั้งหมด" })}
            </WSButton>
          </div>
        </>
      }
    >
      <div className="flex items-center gap-2 px-6 py-2.5 border-b border-fg/[0.06] flex-shrink-0">
        <span className="text-xs font-bold text-fg/50">{t("quickAdd.itemsList", { defaultValue: "รายการที่จะเพิ่ม" })}</span>
        <button onClick={addRow} className="ml-auto h-9 px-4 rounded-lg text-sm font-bold text-brand border border-brand/30 hover:bg-brand/10 flex items-center gap-1.5 transition-colors">
          <Plus className="w-4 h-4" />{t("quickAdd.addModel", { defaultValue: "เพิ่มรายการ" })}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
            {rows.map((r) => {
              const n = qtyOf(r);
              const canExpand = mode === "unit" && n > 0;
              return (
                <div key={r.id} className="rounded-xl border border-fg/[0.08] bg-fg/[0.02] p-2.5 flex flex-col gap-1.5">
                  {/* บรรทัด: แบรนด์ / หมวด / หมวดย่อย */}
                  <div className="flex items-start gap-1.5">
                    <div className="grid grid-cols-3 gap-1.5 flex-1 min-w-0">
                      <Combo compact value={r.brand} onChange={(v) => setField(r.id, "brand", v)} options={brandOptions} placeholder={tc("brand")} />
                      <Combo compact value={r.category} onChange={(v) => setRowCategory(r.id, v)} options={categoryOptions} placeholder={tc("category")} />
                      <Combo compact value={r.subCategory} onChange={(v) => setField(r.id, "subCategory", v)} options={subsFor(r.category)}
                        placeholder={tc("subCategory")} disabled={!r.category} disabledHint={tc("subCategory")} />
                    </div>
                    <button onClick={() => removeRow(r.id)} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-fg/40 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* บรรทัด: ชื่อรุ่น / จำนวน / กาง */}
                  <div className="grid grid-cols-[1.5rem_1fr_5rem] gap-1.5 items-center">
                    {canExpand ? (
                      <button onClick={() => toggleOpen(r.id)} title={t("quickAdd.unitDetails", { defaultValue: "รายละเอียดหน่วย" })}
                        className="w-6 h-8 flex items-center justify-center text-fg/40 hover:text-brand transition-colors">
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${r.open ? "" : "-rotate-90"}`} />
                      </button>
                    ) : <span />}
                    <input value={r.name} onChange={(e) => setField(r.id, "name", e.target.value)}
                      placeholder={t("quickAdd.modelPlaceholder", { defaultValue: "เช่น DC-300A Series II" })}
                      className="h-8 bg-black/40 border border-fg/10 rounded-lg text-xs text-fg px-2.5 placeholder:text-fg/40 focus:outline-none focus:border-brand/40 transition-colors" />
                    <input type="number" min={0} value={r.qty} onChange={(e) => setField(r.id, "qty", e.target.value)}
                      placeholder={tc("quantity")}
                      className="h-8 bg-black/40 border border-fg/10 rounded-lg text-xs text-fg px-2.5 text-center focus:outline-none focus:border-brand/40 transition-colors [color-scheme:dark]" />
                  </div>
                  {/* บรรทัด: ราคาซื้อ / ค่าเช่า/วัน */}
                  <div className="grid grid-cols-[1.5rem_1fr_1fr] gap-1.5 items-center">
                    <span />
                    <input type="number" value={r.purchaseCost} onChange={(e) => setField(r.id, "purchaseCost", e.target.value)}
                      placeholder={t("quickAdd.purchaseCost", { defaultValue: "ราคาซื้อ" })}
                      className="h-8 bg-black/40 border border-fg/10 rounded-lg text-xs text-fg px-2.5 placeholder:text-fg/40 focus:outline-none focus:border-brand/40 [color-scheme:dark]" />
                    <input type="number" value={r.dailyRate} onChange={(e) => setField(r.id, "dailyRate", e.target.value)}
                      placeholder={t("quickAdd.dailyRate", { defaultValue: "ค่าเช่า/วัน" })}
                      className="h-8 bg-black/40 border border-fg/10 rounded-lg text-xs text-fg px-2.5 placeholder:text-fg/40 focus:outline-none focus:border-brand/40 [color-scheme:dark]" />
                  </div>

                  {/* กาง: รายละเอียดต่อ unit */}
                  {r.open && canExpand && (
                    <div className="ml-6 mt-1 border-l border-fg/10 pl-3 flex flex-col gap-2 animate-fade-in">
                      {Array.from({ length: n }).map((_, ui) => {
                        const autoName = `${r.name || "?"} #${String(ui + 1).padStart(2, "0")}`;
                        const autoBc = `${slugify(r.name || "ITEM")}-${String(ui + 1).padStart(3, "0")}`;
                        return (
                          <div key={ui} className="rounded-lg bg-black/20 p-2 flex flex-col gap-1.5">
                            <span className="text-[11px] font-semibold text-fg/60 truncate">{autoName}</span>
                            <div className="grid grid-cols-2 gap-2">
                              <input value={r.units[ui]?.serial ?? ""} onChange={(e) => setUnit(r.id, ui, "serial", e.target.value)} placeholder={tc("serial")}
                                className="h-8 bg-black/40 border border-fg/10 rounded text-xs font-mono text-fg px-2 placeholder:text-fg/30 focus:outline-none focus:border-brand/40" />
                              <input value={r.units[ui]?.barcode ?? ""} onChange={(e) => setUnit(r.id, ui, "barcode", e.target.value)} placeholder={autoBc}
                                className="h-8 bg-black/40 border border-fg/10 rounded text-xs font-mono text-fg px-2 placeholder:text-fg/30 focus:outline-none focus:border-brand/40" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] text-fg/40">{t("quickAdd.purchasedAt", { defaultValue: "วันที่ซื้อ" })}</span>
                                <input type="date" value={r.units[ui]?.purchasedAt ?? ""} onChange={(e) => setUnit(r.id, ui, "purchasedAt", e.target.value)}
                                  className="h-8 bg-black/40 border border-fg/10 rounded text-xs text-fg px-2 focus:outline-none focus:border-brand/40 [color-scheme:dark]" />
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] text-fg/40">{t("quickAdd.warrantyExpiresAt", { defaultValue: "ประกันหมดอายุ" })}</span>
                                <input type="date" value={r.units[ui]?.warrantyExpiresAt ?? ""} onChange={(e) => setUnit(r.id, ui, "warrantyExpiresAt", e.target.value)}
                                  className="h-8 bg-black/40 border border-fg/10 rounded text-xs text-fg px-2 focus:outline-none focus:border-brand/40 [color-scheme:dark]" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-[9px] text-fg/30 italic">{t("quickAdd.unitAutoHint", { defaultValue: "เว้นว่าง = สร้างอัตโนมัติ" })}</p>
                    </div>
                  )}
                </div>
              );
            })}

            <button onClick={addRow}
              className="w-full h-10 rounded-xl border border-dashed border-fg/15 hover:border-brand/50 text-fg/60 hover:text-brand text-sm font-medium flex items-center justify-center gap-2 transition-all">
              <Plus className="w-4 h-4" />{t("quickAdd.addModel", { defaultValue: "เพิ่มรายการ" })}
            </button>
          </div>
    </WorkspaceShell>
  );
};
