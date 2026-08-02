import React, { useState, useMemo } from "react";
import { X, Pencil, Trash2, Plus, Tag, Layers, ChevronRight, ArrowLeft, Search, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { catalogApi, stockApi } from "@/api";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { FileUploadField } from "@/components/FileUploadField";
import type { Brand, Category, SubCategory, StockItem } from "@shared/schema";

const avatarColors = [
  "var(--brand)", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FECA57", "#FF9FF3", "#54A0FF", "#5F27CD", "#00D2D3",
];
const getBgColor = (name: string) => avatarColors[(name.charCodeAt(0) || 0) % avatarColors.length];

const BrandAvatar = ({ name, logoUrl, size = "w-8 h-8" }: { name: string; logoUrl?: string | null; size?: string }) =>
  logoUrl ? (
    <img src={logoUrl} alt={name} className={`${size} rounded-lg object-cover border border-fg/10 flex-shrink-0`} />
  ) : (
    <span className={`${size} rounded-lg flex items-center justify-center text-xs font-bold text-black flex-shrink-0`} style={{ backgroundColor: getBgColor(name) }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );

// ฟอร์มแก้ไขแบรนด์ (ชื่อ + โลโก้)
const BrandForm = ({ companyId, initial, onSave, onCancel }: {
  companyId: string; initial?: { name: string; logoUrl: string | null };
  onSave: (data: { name: string; logoUrl: string | null }) => void; onCancel: () => void;
}) => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const [name, setName] = useState(initial?.name ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logoUrl ?? null);
  return (
    <div className="p-3 bg-fg/5 rounded-xl border border-fg/10 flex flex-col gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("brandCategory.brandNamePlaceholder")}
        className="h-8 px-3 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg placeholder:text-fg/60 focus:outline-none focus:border-brand/50" />
      <FileUploadField label="Brand Logo" folder="brands" companyId={companyId} value={logoUrl} onChange={setLogoUrl} />
      <div className="flex gap-2 mt-1">
        <button onClick={onCancel} className="flex-1 h-8 rounded-lg border border-fg/10 text-xs text-fg/50 hover:text-fg">{tc("cancel")}</button>
        <button onClick={() => onSave({ name, logoUrl })} className="flex-1 h-8 rounded-lg text-xs font-bold text-black hover:opacity-80" style={{ backgroundColor: "var(--brand)" }}>{tc("save")}</button>
      </div>
    </div>
  );
};

// ฟอร์มแก้ไขหมวดย่อย (ชื่อ + หมวดแม่)
const SubCategoryForm = ({ categoryOptions, initial, onSave, onCancel }: {
  categoryOptions: string[]; initial?: { name: string; parentCategory: string };
  onSave: (data: { name: string; parentCategory: string }) => void; onCancel: () => void;
}) => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const [name, setName] = useState(initial?.name ?? "");
  const [parentCategory, setParentCategory] = useState(initial?.parentCategory ?? "");
  const [showSug, setShowSug] = useState(false);
  const sug = parentCategory.trim() ? categoryOptions.filter((c) => c.toLowerCase().includes(parentCategory.toLowerCase())) : categoryOptions;
  return (
    <div className="p-3 bg-fg/5 rounded-xl border border-fg/10 flex flex-col gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("brandCategory.subCategoryNamePlaceholder")}
        className="h-8 px-3 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg placeholder:text-fg/60 focus:outline-none focus:border-brand/50" />
      <div className="relative">
        <input value={parentCategory} onChange={(e) => setParentCategory(e.target.value)} onFocus={() => setShowSug(true)} onBlur={() => setTimeout(() => setShowSug(false), 150)}
          placeholder={t("brandCategory.parentCategoryPlaceholder")}
          className="w-full h-8 px-3 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg placeholder:text-fg/60 focus:outline-none focus:border-brand/50" />
        {showSug && sug.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-surface-1 border border-fg/10 rounded-lg shadow-xl overflow-hidden max-h-36 overflow-y-auto">
            {sug.map((c) => <button key={c} onMouseDown={() => { setParentCategory(c); setShowSug(false); }} className="w-full text-left px-3 py-2 text-sm text-fg/70 hover:bg-brand/10 hover:text-brand">{c}</button>)}
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-1">
        <button onClick={onCancel} className="flex-1 h-8 rounded-lg border border-fg/10 text-xs text-fg/50 hover:text-fg">{tc("cancel")}</button>
        <button onClick={() => onSave({ name, parentCategory })} className="flex-1 h-8 rounded-lg text-xs font-bold text-black hover:opacity-80" style={{ backgroundColor: "var(--brand)" }}>{tc("save")}</button>
      </div>
    </div>
  );
};

// ฟอร์มชื่อเดียว (แก้ไขหมวด)
const NameForm = ({ initial, placeholder, onSave, onCancel }: { initial?: string; placeholder: string; onSave: (v: string) => void; onCancel: () => void }) => {
  const { t: tc } = useTranslation("common");
  const [name, setName] = useState(initial ?? "");
  return (
    <div className="flex items-center gap-2 p-2 bg-fg/5 rounded-xl border border-brand/30">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); if (e.key === "Escape") onCancel(); }}
        placeholder={placeholder} className="flex-1 h-8 px-3 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg placeholder:text-fg/50 focus:outline-none focus:border-brand/50" />
      <button onClick={() => name.trim() && onSave(name.trim())} className="h-8 px-3 rounded-lg text-xs font-bold text-black hover:opacity-80" style={{ backgroundColor: "var(--brand)" }}>{tc("save")}</button>
      <button onClick={onCancel} className="h-8 px-3 rounded-lg border border-fg/10 text-xs text-fg/50 hover:text-fg">{tc("cancel")}</button>
    </div>
  );
};

const SearchInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg/50" />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full h-9 bg-black/40 border border-fg/10 rounded-lg pl-9 pr-8 text-sm text-fg placeholder:text-fg/40 focus:outline-none focus:border-brand/40" />
    {value && <button onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg/50 hover:text-fg"><X className="w-3.5 h-3.5" /></button>}
  </div>
);

type Tab = "categories" | "brands";
type ItemWithCount = StockItem & { unitCount?: number };

interface BrandCategoryModalProps { onClose: () => void; }

export const BrandCategoryModal = ({ onClose }: BrandCategoryModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token, companyId } = useAppStore();
  const qc = useQueryClient();

  const { data: brands = [] } = useQuery({ queryKey: ["catalog", "brands"], queryFn: catalogApi.getBrands, enabled: !!token });
  const { data: categories = [] } = useQuery({ queryKey: ["catalog", "categories"], queryFn: catalogApi.getCategories, enabled: !!token });
  const { data: subCategories = [] } = useQuery({ queryKey: ["catalog", "subcategories"], queryFn: catalogApi.getSubCategories, enabled: !!token });
  const { data: stockItems = [] } = useQuery({ queryKey: ["stock"], queryFn: stockApi.getAll, enabled: !!token });

  const invalidateCatalog = () => {
    for (const k of ["brands", "categories", "subcategories"]) {
      qc.invalidateQueries({ queryKey: ["catalog", k] });
      qc.invalidateQueries({ queryKey: [`catalog-${k}`] });
    }
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["stock-with-units"] });
  };

  // group สินค้าเข้าหมวด/แบรนด์ เพื่อโชว์จำนวน + รายการตอนกดเข้าไป
  const { itemsByCat, itemsByBrand } = useMemo(() => {
    const c = new Map<string, ItemWithCount[]>();
    const b = new Map<string, ItemWithCount[]>();
    for (const it of stockItems as ItemWithCount[]) {
      if (!c.has(it.category)) c.set(it.category, []);
      c.get(it.category)!.push(it);
      if (!b.has(it.brand)) b.set(it.brand, []);
      b.get(it.brand)!.push(it);
    }
    return { itemsByCat: c, itemsByBrand: b };
  }, [stockItems]);

  const unitsOf = (arr?: ItemWithCount[]) => (arr ?? []).reduce((s, i) => s + (i.unitCount ?? 0), 0);

  // ── mutations ──
  const createBrand = useMutation({ mutationFn: catalogApi.createBrand, onSuccess: invalidateCatalog });
  const updateBrand = useMutation({ mutationFn: ({ id, data }: { id: string; data: Parameters<typeof catalogApi.updateBrand>[1] }) => catalogApi.updateBrand(id, data), onSuccess: invalidateCatalog });
  const deleteBrand = useMutation({ mutationFn: catalogApi.deleteBrand, onSuccess: invalidateCatalog });
  const createCategory = useMutation({ mutationFn: catalogApi.createCategory, onSuccess: invalidateCatalog });
  const updateCategory = useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => catalogApi.updateCategory(id, { name }), onSuccess: invalidateCatalog });
  const deleteCategory = useMutation({ mutationFn: catalogApi.deleteCategory, onSuccess: invalidateCatalog });
  const createSubCategory = useMutation({ mutationFn: catalogApi.createSubCategory, onSuccess: invalidateCatalog });
  const updateSubCategory = useMutation({ mutationFn: ({ id, data }: { id: string; data: { name?: string; parentCategory?: string } }) => catalogApi.updateSubCategory(id, data), onSuccess: invalidateCatalog });
  const deleteSubCategory = useMutation({ mutationFn: catalogApi.deleteSubCategory, onSuccess: invalidateCatalog });

  const batchAdd = useMutation({
    mutationFn: async ({ tab, names }: { tab: Tab; names: string[] }) => {
      for (const n of names) {
        if (tab === "categories") await catalogApi.createCategory({ name: n });
        else await catalogApi.createBrand({ name: n, logoUrl: null });
      }
    },
    onSuccess: invalidateCatalog,
  });

  // ── state ──
  const [activeTab, setActiveTab] = useState<Tab>("categories");
  const [drill, setDrill] = useState<string | null>(null);   // ชื่อหมวด/แบรนด์ที่กดเข้าไป
  const [search, setSearch] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batch, setBatch] = useState<{ id: number; name: string }[]>([{ id: 1, name: "" }, { id: 2, name: "" }, { id: 3, name: "" }]);
  const [editBrandId, setEditBrandId] = useState<string | null>(null);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editSubId, setEditSubId] = useState<string | null>(null);
  const [addSubOpen, setAddSubOpen] = useState(false);

  const switchTab = (tabTo: Tab) => { setActiveTab(tabTo); setDrill(null); setSearch(""); setBatchOpen(false); };

  const inc = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase());
  const sortedCats = useMemo(() => [...categories].sort((a: Category, b: Category) => a.name.localeCompare(b.name)), [categories]);
  const sortedBrands = useMemo(() => [...brands].sort((a: Brand, b: Brand) => a.name.localeCompare(b.name)), [brands]);
  const visCats = search ? sortedCats.filter((c) => inc(c.name, search)) : sortedCats;
  const visBrands = search ? sortedBrands.filter((b) => inc(b.name, search)) : sortedBrands;

  const addBatchRow = () => setBatch((r) => [...r, { id: Date.now(), name: "" }]);
  const saveBatch = () => {
    const names = batch.map((b) => b.name.trim()).filter(Boolean);
    if (!names.length) return;
    batchAdd.mutate({ tab: activeTab, names }, { onSuccess: () => { setBatch([{ id: Date.now(), name: "" }]); setBatchOpen(false); } });
  };

  const catOptions = sortedCats.map((c) => c.name);

  // รายการสินค้าใน drill ปัจจุบัน
  const drillItems: ItemWithCount[] = drill ? (activeTab === "categories" ? itemsByCat.get(drill) : itemsByBrand.get(drill)) ?? [] : [];
  const drillSubs = drill && activeTab === "categories" ? (subCategories as SubCategory[]).filter((s) => s.parentCategory === drill) : [];

  return (
    <WorkspaceShell
      icon={<Tag className="w-4 h-4 text-black" />}
      title={t("brandCategory.title")}
      onClose={onClose}
      tabs={[
        { key: "categories", label: t("brandCategory.categoryManagement"), Icon: Layers, count: categories.length },
        { key: "brands", label: t("brandCategory.brandManagement"), Icon: Tag, count: brands.length },
      ]}
      activeTab={activeTab}
      onTabChange={(k) => switchTab(k as Tab)}
    >
      {drill ? (
        /* ─────────── DETAIL: กดการ์ดเข้ามาดูสินค้าข้างใน ─────────── */
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-3 border-b border-fg/[0.06] flex-shrink-0">
            <button onClick={() => setDrill(null)} className="tap-target flex items-center gap-1.5 h-11 md:h-8 px-3 rounded-lg text-sm text-fg/70 hover:text-fg hover:bg-fg/5 transition-colors">
              <ArrowLeft className="w-4 h-4" />{tc("back")}
            </button>
            {activeTab === "brands"
              ? <BrandAvatar name={drill} logoUrl={brands.find((b: Brand) => b.name === drill)?.logoUrl} />
              : <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: getBgColor(drill) }}><Layers className="w-4 h-4 text-black" /></span>}
            <h2 className="text-base font-bold text-fg truncate">{drill}</h2>
            <span className="text-xs text-fg/40 hidden sm:inline">{t("brandCategory.itemsCount", { count: drillItems.length, defaultValue: "{{count}} รุ่น" })} · {unitsOf(drillItems)} {tc("units")}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-6 flex flex-col gap-4">
            {/* หมวดย่อย (เฉพาะแท็บหมวด) */}
            {activeTab === "categories" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-fg/50">{t("brandCategory.subCategoryManagement")}</span>
                  <span className="text-[10px] text-fg/40">{drillSubs.length}</span>
                  <button onClick={() => setAddSubOpen(true)} className="tap-target ml-auto h-7 px-3 rounded-lg text-[11px] font-bold text-brand border border-brand/30 hover:bg-brand/10 flex items-center gap-1.5">
                    <Plus className="w-3 h-3" />{t("brandCategory.addNewSubCategory")}
                  </button>
                </div>
                {addSubOpen && (
                  <SubCategoryForm categoryOptions={catOptions} initial={{ name: "", parentCategory: drill }}
                    onSave={(d) => { if (d.name.trim()) createSubCategory.mutate({ name: d.name.trim(), parentCategory: d.parentCategory.trim() || drill }); setAddSubOpen(false); }}
                    onCancel={() => setAddSubOpen(false)} />
                )}
                <div className="flex flex-wrap gap-2">
                  {drillSubs.length === 0 && !addSubOpen && <span className="text-xs text-fg/30 italic">{t("brandCategory.noSubsYet", { defaultValue: "ยังไม่มีหมวดย่อย" })}</span>}
                  {drillSubs.map((s: SubCategory) => (
                    editSubId === s.id ? (
                      <div key={s.id} className="w-full max-w-sm">
                        <SubCategoryForm categoryOptions={catOptions} initial={{ name: s.name, parentCategory: s.parentCategory }}
                          onSave={(d) => { if (d.name.trim()) updateSubCategory.mutate({ id: s.id, data: { name: d.name.trim(), parentCategory: d.parentCategory.trim() } }); setEditSubId(null); }}
                          onCancel={() => setEditSubId(null)} />
                      </div>
                    ) : (
                      <div key={s.id} className="group flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-lg bg-fg/[0.05] border border-fg/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand/60" />
                        <span className="text-sm text-fg/85">{s.name}</span>
                        <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditSubId(s.id)} className="tap-target p-1 rounded text-fg/50 hover:text-brand"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => deleteSubCategory.mutate(s.id)} className="tap-target p-1 rounded text-fg/50 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
                <div className="h-px bg-fg/[0.06] mt-1" />
              </div>
            )}

            {/* รายการสินค้า (รุ่น) ในหมวด/แบรนด์นี้ */}
            <span className="text-xs font-bold text-fg/50">{t("brandCategory.itemsInside", { defaultValue: "สินค้าในนี้" })}</span>
            {drillItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-fg/30">
                <Package className="w-10 h-10 mb-2" />
                <p className="text-sm">{t("brandCategory.noItems", { defaultValue: "ยังไม่มีสินค้าในนี้" })}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {[...drillItems].sort((a, b) => a.name.localeCompare(b.name)).map((it) => (
                  <div key={it.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-fg/[0.03] border border-fg/[0.06]">
                    <Package className="w-4 h-4 text-brand/50 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg/90 truncate">{it.name}</p>
                      <p className="text-[10px] text-fg/40 truncate">{activeTab === "categories" ? it.brand : it.category}{it.subCategory ? ` · ${it.subCategory}` : ""}</p>
                    </div>
                    {typeof it.unitCount === "number" && <span className="text-[11px] text-fg/40 flex-shrink-0">{it.unitCount}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ─────────── GRID: การ์ดหมวด/แบรนด์ + เพิ่มทีละหลายอัน ─────────── */
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-3 border-b border-fg/[0.06] flex-shrink-0">
            <div className="flex-1 max-w-md"><SearchInput value={search} onChange={setSearch} placeholder={tc("search")} /></div>
            <button onClick={() => setBatchOpen((v) => !v)}
              className="tap-target h-11 md:h-9 px-4 rounded-xl md:rounded-lg text-sm font-bold text-black flex items-center gap-2 hover:opacity-90 flex-shrink-0" style={{ backgroundColor: "var(--brand)" }}>
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">{t("brandCategory.addMany", { defaultValue: "เพิ่มทีละหลายอัน" })}</span>
            </button>
          </div>

          {/* แผงเพิ่มทีละหลายอัน */}
          {batchOpen && (
            <div className="px-3 md:px-6 py-4 border-b border-fg/[0.06] bg-surface-1 flex-shrink-0">
              <p className="text-xs text-fg/50 mb-2">{t("brandCategory.addManyHint", { defaultValue: "พิมพ์หลายชื่อ แล้วบันทึกทีเดียว" })}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {batch.map((row, i) => (
                  <div key={row.id} className="flex items-center gap-1">
                    <input value={row.name}
                      onChange={(e) => setBatch((r) => r.map((x) => x.id === row.id ? { ...x, name: e.target.value } : x))}
                      onKeyDown={(e) => { if (e.key === "Enter" && i === batch.length - 1 && row.name.trim()) addBatchRow(); }}
                      placeholder={activeTab === "categories" ? t("brandCategory.categoryNamePlaceholder") : t("brandCategory.brandNamePlaceholder")}
                      className="flex-1 h-11 md:h-9 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg px-3 placeholder:text-fg/40 focus:outline-none focus:border-brand/40" />
                    {batch.length > 1 && <button onClick={() => setBatch((r) => r.filter((x) => x.id !== row.id))} className="tap-target w-7 h-7 flex items-center justify-center rounded text-fg/40 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={addBatchRow} className="tap-target h-8 px-3 rounded-lg border border-dashed border-fg/15 hover:border-brand/50 text-fg/60 hover:text-brand text-xs font-medium flex items-center gap-1.5">
                  <Plus className="w-3 h-3" />{t("brandCategory.addRow", { defaultValue: "เพิ่มแถว" })}
                </button>
                <span className="text-xs text-fg/40">{batch.filter((b) => b.name.trim()).length} {tc("items")}</span>
                <button onClick={() => setBatchOpen(false)} className="tap-target ml-auto h-8 px-3 rounded-lg border border-fg/10 text-xs text-fg/60 hover:text-fg">{tc("cancel")}</button>
                <button onClick={saveBatch} disabled={batchAdd.isPending || batch.every((b) => !b.name.trim())}
                  className="tap-target h-8 px-4 rounded-lg text-xs font-bold text-black hover:opacity-80 disabled:opacity-40" style={{ backgroundColor: "var(--brand)" }}>
                  {t("quickAdd.saveAll", { defaultValue: "บันทึกทั้งหมด" })}
                </button>
              </div>
            </div>
          )}

          {/* การ์ดกริด */}
          <div className="flex-1 overflow-y-auto p-3 md:p-6">
            {activeTab === "categories" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {visCats.map((c: Category, i: number) => (
                  editCatId === c.id ? (
                    <div key={c.id} className="col-span-full max-w-md"><NameForm initial={c.name} placeholder={t("brandCategory.categoryNamePlaceholder")} onSave={(v) => { updateCategory.mutate({ id: c.id, name: v }); setEditCatId(null); }} onCancel={() => setEditCatId(null)} /></div>
                  ) : (
                    <button key={c.id} onClick={() => setDrill(c.name)}
                      className="group relative flex items-center gap-3 p-4 rounded-xl bg-fg/[0.03] border border-fg/[0.08] hover:border-brand/40 hover:bg-fg/[0.05] transition-colors text-left">
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0" style={{ backgroundColor: avatarColors[i % avatarColors.length] }}>{(i + 1).toString().padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-fg truncate">{c.name}</p>
                        <p className="text-[11px] text-fg/40">{(itemsByCat.get(c.name)?.length ?? 0)} {t("brandCategory.modelsShort", { defaultValue: "รุ่น" })} · {unitsOf(itemsByCat.get(c.name))} {tc("units")}</p>
                      </div>
                      <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setEditCatId(c.id); }} className="tap-target p-1.5 rounded text-fg/50 hover:text-brand"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteCategory.mutate(c.id); }} className="tap-target p-1.5 rounded text-fg/50 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <ChevronRight className="w-4 h-4 text-fg/30 flex-shrink-0" />
                    </button>
                  )
                ))}
                {visCats.length === 0 && <p className="col-span-full text-center text-sm text-fg/40 py-10 italic">{tc("noResults")}</p>}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {visBrands.map((b: Brand) => (
                  editBrandId === b.id ? (
                    <div key={b.id} className="col-span-full max-w-md"><BrandForm companyId={companyId ?? ""} initial={{ name: b.name, logoUrl: b.logoUrl }} onSave={(d) => { if (d.name.trim()) updateBrand.mutate({ id: b.id, data: { name: d.name.trim(), logoUrl: d.logoUrl } }); setEditBrandId(null); }} onCancel={() => setEditBrandId(null)} /></div>
                  ) : (
                    <button key={b.id} onClick={() => setDrill(b.name)}
                      className="group relative flex items-center gap-3 p-4 rounded-xl bg-fg/[0.03] border border-fg/[0.08] hover:border-brand/40 hover:bg-fg/[0.05] transition-colors text-left">
                      <BrandAvatar name={b.name} logoUrl={b.logoUrl} size="w-9 h-9" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-fg truncate">{b.name}</p>
                        <p className="text-[11px] text-fg/40">{(itemsByBrand.get(b.name)?.length ?? 0)} {t("brandCategory.modelsShort", { defaultValue: "รุ่น" })} · {unitsOf(itemsByBrand.get(b.name))} {tc("units")}</p>
                      </div>
                      <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setEditBrandId(b.id); }} className="tap-target p-1.5 rounded text-fg/50 hover:text-brand"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); deleteBrand.mutate(b.id); }} className="tap-target p-1.5 rounded text-fg/50 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <ChevronRight className="w-4 h-4 text-fg/30 flex-shrink-0" />
                    </button>
                  )
                ))}
                {visBrands.length === 0 && <p className="col-span-full text-center text-sm text-fg/40 py-10 italic">{tc("noResults")}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
};
