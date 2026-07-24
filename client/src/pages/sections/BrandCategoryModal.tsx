import React, { useState } from "react";
import { X, Pencil, Trash2, Plus, Tag, Layers, ChevronDown, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { catalogApi } from "@/api";
import { FileUploadField } from "@/components/FileUploadField";
import type { Brand, Category, SubCategory } from "@shared/schema";

const avatarColors = [
  "#FFFF00", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FECA57", "#FF9FF3", "#54A0FF", "#5F27CD", "#00D2D3",
];
const getBgColor = (name: string) =>
  avatarColors[name.charCodeAt(0) % avatarColors.length];

const BrandAvatar = ({ name, logoUrl }: { name: string; logoUrl?: string | null }) =>
  logoUrl ? (
    <img src={logoUrl} alt={name} className="w-8 h-8 rounded-lg object-cover border border-white/10 flex-shrink-0" />
  ) : (
    <span
      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
      style={{ backgroundColor: getBgColor(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );

interface BrandFormProps {
  companyId: string;
  initial?: { name: string; logoUrl: string | null };
  onSave: (data: { name: string; logoUrl: string | null }) => void;
  onCancel: () => void;
}
const BrandForm = ({ companyId, initial, onSave, onCancel }: BrandFormProps) => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const [name, setName] = useState(initial?.name ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logoUrl ?? null);
  return (
    <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-2 animate-modal-up">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/60 uppercase tracking-wider">{t("brandCategory.brandName")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("brandCategory.brandNamePlaceholder")}
          className="h-8 px-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/50 transition-colors"
        />
      </div>
      <FileUploadField label="Brand Logo" folder="brands" companyId={companyId} value={logoUrl} onChange={setLogoUrl} />
      <div className="flex gap-2 mt-1">
        <button
          onClick={onCancel}
          className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/30 transition-colors"
        >
          {tc("cancel")}
        </button>
        <button
          onClick={() => onSave({ name, logoUrl })}
          className="flex-1 h-8 rounded-lg text-xs font-bold text-black transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#FFFF00" }}
        >
          {tc("save")}
        </button>
      </div>
    </div>
  );
};

// ช่องค้นหาเล็กสำหรับหัวคอลัมน์ (module scope — กัน remount/โฟกัสหลุดตอนพิมพ์)
const SearchInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative mb-2">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50" />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-8 bg-black/40 border border-white/10 rounded-lg pl-8 pr-7 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
    />
    {value && <button onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"><X className="w-3 h-3" /></button>}
  </div>
);

interface AddFormProps {
  fields: { key: string; label: string; placeholder: string }[];
  initial?: Record<string, string>;
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
}
const AddForm = ({ fields, initial, onSave, onCancel }: AddFormProps) => {
  const { t: tc } = useTranslation("common");
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] ?? ""]))
  );
  return (
    <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-2 animate-modal-up">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label className="text-[10px] text-white/60 uppercase tracking-wider">{f.label}</label>
          <input
            value={vals[f.key]}
            onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className="h-8 px-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/50 transition-colors"
          />
        </div>
      ))}
      <div className="flex gap-2 mt-1">
        <button
          onClick={onCancel}
          className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/30 transition-colors"
        >
          {tc("cancel")}
        </button>
        <button
          onClick={() => { onSave(vals); }}
          className="flex-1 h-8 rounded-lg text-xs font-bold text-black transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#FFFF00" }}
        >
          {tc("save")}
        </button>
      </div>
    </div>
  );
};

interface SubCategoryFormProps {
  categoryOptions: string[];
  initial?: { name: string; parentCategory: string };
  onSave: (data: { name: string; parentCategory: string }) => void;
  onCancel: () => void;
}
const SubCategoryForm = ({ categoryOptions, initial, onSave, onCancel }: SubCategoryFormProps) => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const [name, setName] = useState(initial?.name ?? "");
  const [parentCategory, setParentCategory] = useState(initial?.parentCategory ?? "");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = parentCategory.trim()
    ? categoryOptions.filter((c) => c.toLowerCase().includes(parentCategory.toLowerCase()))
    : categoryOptions;

  return (
    <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-2 animate-modal-up">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/60 uppercase tracking-wider">{t("brandCategory.subCategoryName")}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("brandCategory.subCategoryNamePlaceholder")}
          className="h-8 px-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/50 transition-colors"
        />
      </div>
      <div className="flex flex-col gap-1 relative">
        <label className="text-[10px] text-white/60 uppercase tracking-wider">{t("brandCategory.parentCategory")}</label>
        <input
          value={parentCategory}
          onChange={(e) => setParentCategory(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={t("brandCategory.parentCategoryPlaceholder")}
          className="h-8 px-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/50 transition-colors"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[#111] border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-36 overflow-y-auto">
            {suggestions.map((c) => (
              <button
                key={c}
                onMouseDown={() => { setParentCategory(c); setShowSuggestions(false); }}
                className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-[#FFFF00]/10 hover:text-[#FFFF00] transition-colors"
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-1">
        <button
          onClick={onCancel}
          className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/30 transition-colors"
        >
          {tc("cancel")}
        </button>
        <button
          onClick={() => onSave({ name, parentCategory })}
          className="flex-1 h-8 rounded-lg text-xs font-bold text-black transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#FFFF00" }}
        >
          {tc("save")}
        </button>
      </div>
    </div>
  );
};

interface BrandCategoryModalProps {
  onClose: () => void;
}

export const BrandCategoryModal = ({ onClose }: BrandCategoryModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token, companyId } = useAppStore();
  const qc = useQueryClient();

  const { data: brands = [] } = useQuery({
    queryKey: ["catalog", "brands"],
    queryFn: catalogApi.getBrands,
    enabled: !!token,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: catalogApi.getCategories,
    enabled: !!token,
  });
  const { data: subCategories = [] } = useQuery({
    queryKey: ["catalog", "subcategories"],
    queryFn: catalogApi.getSubCategories,
    enabled: !!token,
  });

  const createBrand = useMutation({
    mutationFn: catalogApi.createBrand,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "brands"] }),
  });
  const updateBrand = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof catalogApi.updateBrand>[1] }) =>
      catalogApi.updateBrand(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "brands"] }),
  });
  const deleteBrand = useMutation({
    mutationFn: catalogApi.deleteBrand,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "brands"] }),
  });

  // rename หมวด/หมวดย่อย cascade ไปที่ stock_items + sub.parentCategory → ต้อง invalidate ครบทั้ง 2 สไตล์ key
  // (modal ใช้ ["catalog","x"], filter sidebar ใช้ ["catalog-x"]) + ["stock"]
  const invalidateCatalog = () => {
    for (const k of ["brands", "categories", "subcategories"]) {
      qc.invalidateQueries({ queryKey: ["catalog", k] });
      qc.invalidateQueries({ queryKey: [`catalog-${k}`] });
    }
    qc.invalidateQueries({ queryKey: ["stock"] });
    qc.invalidateQueries({ queryKey: ["stock-with-units"] });
  };

  const createCategory = useMutation({
    mutationFn: catalogApi.createCategory,
    onSuccess: invalidateCatalog,
  });
  const updateCategory = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => catalogApi.updateCategory(id, { name }),
    onSuccess: invalidateCatalog,
  });
  const deleteCategory = useMutation({
    mutationFn: catalogApi.deleteCategory,
    onSuccess: invalidateCatalog,
  });

  const createSubCategory = useMutation({
    mutationFn: catalogApi.createSubCategory,
    onSuccess: invalidateCatalog,
  });
  const updateSubCategory = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; parentCategory?: string } }) => catalogApi.updateSubCategory(id, data),
    onSuccess: invalidateCatalog,
  });
  const deleteSubCategory = useMutation({
    mutationFn: catalogApi.deleteSubCategory,
    onSuccess: invalidateCatalog,
  });

  const [activeTab, setActiveTab] = useState<"categories" | "brands">("categories");
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);  // ชื่อหมวดที่กำลังเพิ่มหมวดย่อยเข้าไป
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const [brandSearch, setBrandSearch] = useState("");
  const [catSearch, setCatSearch] = useState("");

  const inc = (a: string, b: string) => a.toLowerCase().includes(b.toLowerCase());
  const filteredBrands = brandSearch ? brands.filter((b: Brand) => inc(b.name, brandSearch)) : brands;

  // จัดกลุ่มหมวดย่อยใต้หมวดแม่ (ต้นไม้) + หา orphan ที่ parent ไม่ตรงหมวดไหน
  const subsByCat = new Map<string, SubCategory[]>();
  for (const s of subCategories as SubCategory[]) {
    if (!subsByCat.has(s.parentCategory)) subsByCat.set(s.parentCategory, []);
    subsByCat.get(s.parentCategory)!.push(s);
  }
  for (const arr of Array.from(subsByCat.values())) arr.sort((a, b) => a.name.localeCompare(b.name));
  const categoryNames = new Set(categories.map((c: Category) => c.name));
  const orphanSubs = (subCategories as SubCategory[]).filter((s) => !categoryNames.has(s.parentCategory));

  const q = catSearch.trim().toLowerCase();
  const catMatches = (c: Category) => !q || inc(c.name, q) || (subsByCat.get(c.name) ?? []).some((s) => inc(s.name, q));
  const visibleCategories = categories.filter(catMatches);
  const visibleSubs = (c: Category) => {
    const subs = subsByCat.get(c.name) ?? [];
    return q && !inc(c.name, q) ? subs.filter((s) => inc(s.name, q)) : subs;
  };
  const isExpanded = (name: string) => expandedCats.has(name) || !!q;
  const toggleExpand = (name: string) =>
    setExpandedCats((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const addBrand = (data: { name: string; logoUrl: string | null }) => {
    if (!data.name.trim()) return;
    createBrand.mutate({ name: data.name.trim(), logoUrl: data.logoUrl });
    setShowAddBrand(false);
  };

  const saveBrandEdit = (id: string, data: { name: string; logoUrl: string | null }) => {
    if (!data.name.trim()) return;
    updateBrand.mutate({ id, data: { name: data.name.trim(), logoUrl: data.logoUrl } });
    setEditingBrandId(null);
  };

  const addCategory = (data: Record<string, string>) => {
    if (!data.name.trim()) return;
    createCategory.mutate({ name: data.name.trim() });
    setShowAddCategory(false);
  };

  const saveCategoryEdit = (id: string, data: Record<string, string>) => {
    if (!data.name.trim()) return;
    updateCategory.mutate({ id, name: data.name.trim() });
    setEditingCategoryId(null);
  };

  const addSub = (data: { name: string; parentCategory: string }) => {
    if (!data.name.trim()) return;
    createSubCategory.mutate({ name: data.name.trim(), parentCategory: data.parentCategory.trim() });
    setAddingSubFor(null);
  };

  const saveSubEdit = (id: string, data: { name: string; parentCategory: string }) => {
    if (!data.name.trim()) return;
    updateSubCategory.mutate({ id, data: { name: data.name.trim(), parentCategory: data.parentCategory.trim() } });
    setEditingSubId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl bg-[#111111] rounded-2xl border border-white/10 shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FFFF00" }}>
              <Tag className="w-4 h-4 text-black" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide">{t("brandCategory.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3 flex-shrink-0">
          {([
            { key: "categories" as const, label: t("brandCategory.categoryManagement"), Icon: Layers, count: categories.length },
            { key: "brands" as const, label: t("brandCategory.brandManagement"), Icon: Tag, count: brands.length },
          ]).map(({ key, label, Icon, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-bold transition-colors ${activeTab === key ? "bg-[#FFFF00] text-black" : "text-white/60 hover:text-white hover:bg-white/5"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              <span className={`text-[10px] ${activeTab === key ? "text-black/60" : "text-white/40"}`}>{count}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          {activeTab === "categories" ? (
            <>
              <SearchInput value={catSearch} onChange={setCatSearch} placeholder={tc("search")} />

              {showAddCategory ? (
                <AddForm
                  fields={[{ key: "name", label: t("brandCategory.categoryNameLabel"), placeholder: t("brandCategory.categoryNamePlaceholder") }]}
                  onSave={addCategory}
                  onCancel={() => setShowAddCategory(false)}
                />
              ) : (
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="mb-2 w-full h-9 rounded-xl border border-dashed border-[#FFFF00]/30 hover:border-[#FFFF00]/60 bg-[#FFFF00]/[0.04] hover:bg-[#FFFF00]/[0.08] text-[#FFFF00] text-sm font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("brandCategory.addNewCategory")}
                </button>
              )}

              <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 pr-1">
                {visibleCategories.map((c: Category, i: number) => {
                  const subs = subsByCat.get(c.name) ?? [];
                  const shownSubs = visibleSubs(c);
                  const expanded = isExpanded(c.name);
                  return (
                    <div key={c.id}>
                      {editingCategoryId === c.id ? (
                        <AddForm
                          fields={[{ key: "name", label: t("brandCategory.categoryNameLabel"), placeholder: t("brandCategory.categoryNamePlaceholder") }]}
                          initial={{ name: c.name }}
                          onSave={(data) => saveCategoryEdit(c.id, data)}
                          onCancel={() => setEditingCategoryId(null)}
                        />
                      ) : (
                        <div
                          onClick={() => toggleExpand(c.name)}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/8 group transition-colors cursor-pointer"
                        >
                          <ChevronDown className={`w-4 h-4 text-white/50 flex-shrink-0 transition-transform ${expanded ? "" : "-rotate-90"}`} />
                          <span className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0" style={{ backgroundColor: avatarColors[i % avatarColors.length] }}>
                            {(i + 1).toString().padStart(2, "0")}
                          </span>
                          <span className="text-sm font-medium text-white flex-1 truncate">{c.name}</span>
                          <span className="text-[10px] text-white/40 flex-shrink-0">{subs.length}</span>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-1 rounded text-white/60 hover:text-[#FFFF00] transition-colors" onClick={(e) => { e.stopPropagation(); setEditingCategoryId(c.id); }}>
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button className="p-1 rounded text-white/60 hover:text-red-400 transition-colors" onClick={(e) => { e.stopPropagation(); deleteCategory.mutate(c.id); }}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {expanded && (
                        <div className="ml-5 mt-1 mb-1 flex flex-col gap-1 border-l border-white/10 pl-3">
                          {shownSubs.map((s: SubCategory) => (
                            editingSubId === s.id ? (
                              <SubCategoryForm
                                key={s.id}
                                categoryOptions={categories.map((cc: Category) => cc.name)}
                                initial={{ name: s.name, parentCategory: s.parentCategory }}
                                onSave={(data) => saveSubEdit(s.id, data)}
                                onCancel={() => setEditingSubId(null)}
                              />
                            ) : (
                              <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] group transition-colors">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FFFF00]/60 flex-shrink-0" />
                                <span className="text-sm text-white/85 flex-1 truncate">{s.name}</span>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button className="p-1 rounded text-white/60 hover:text-[#FFFF00] transition-colors" onClick={() => { setEditingSubId(s.id); setAddingSubFor(null); }}>
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button className="p-1 rounded text-white/60 hover:text-red-400 transition-colors" onClick={() => deleteSubCategory.mutate(s.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )
                          ))}
                          {shownSubs.length === 0 && addingSubFor !== c.name && (
                            <p className="text-xs text-white/30 italic px-1 py-1">{t("brandCategory.noSubsYet", { defaultValue: "ยังไม่มีหมวดย่อย" })}</p>
                          )}
                          {addingSubFor === c.name ? (
                            <SubCategoryForm
                              categoryOptions={categories.map((cc: Category) => cc.name)}
                              initial={{ name: "", parentCategory: c.name }}
                              onSave={addSub}
                              onCancel={() => setAddingSubFor(null)}
                            />
                          ) : (
                            <button
                              onClick={() => { setAddingSubFor(c.name); setEditingSubId(null); }}
                              className="w-full h-7 rounded-lg border border-dashed border-white/10 hover:border-[#FFFF00]/40 text-white/50 hover:text-[#FFFF00] text-xs flex items-center justify-center gap-1.5 transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              {t("brandCategory.addNewSubCategory")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {visibleCategories.length === 0 && (
                  <p className="px-2.5 py-3 text-xs text-white/40 italic">{tc("noResults")}</p>
                )}

                {/* Orphan sub-categories (parent ไม่ตรงหมวดไหน) */}
                {(() => {
                  const shownOrphans = q ? orphanSubs.filter((s) => inc(s.name, q)) : orphanSubs;
                  if (shownOrphans.length === 0) return null;
                  return (
                    <div className="mt-2 pt-2 border-t border-white/[0.06]">
                      <p className="text-[10px] text-amber-400/70 uppercase tracking-wider px-1 mb-1">{t("brandCategory.orphanSubs", { defaultValue: "หมวดย่อยไม่มีหมวดแม่" })}</p>
                      {shownOrphans.map((s: SubCategory) => (
                        editingSubId === s.id ? (
                          <SubCategoryForm
                            key={s.id}
                            categoryOptions={categories.map((cc: Category) => cc.name)}
                            initial={{ name: s.name, parentCategory: s.parentCategory }}
                            onSave={(data) => saveSubEdit(s.id, data)}
                            onCancel={() => setEditingSubId(null)}
                          />
                        ) : (
                          <div key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] group transition-colors">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 flex-shrink-0" />
                            <span className="text-sm text-white/85 flex-1 truncate">{s.name}<span className="text-[10px] text-white/40 ml-1.5">↳ {s.parentCategory || "—"}</span></span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-1 rounded text-white/60 hover:text-[#FFFF00] transition-colors" onClick={() => setEditingSubId(s.id)}>
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button className="p-1 rounded text-white/60 hover:text-red-400 transition-colors" onClick={() => deleteSubCategory.mutate(s.id)}>
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  );
                })()}

              </div>
            </>
          ) : (
            <>
              <SearchInput value={brandSearch} onChange={setBrandSearch} placeholder={tc("search")} />

              {showAddBrand ? (
                <BrandForm companyId={companyId ?? ""} onSave={addBrand} onCancel={() => setShowAddBrand(false)} />
              ) : (
                <button
                  onClick={() => { setShowAddBrand(true); setEditingBrandId(null); }}
                  className="mb-2 w-full h-9 rounded-xl border border-dashed border-[#FFFF00]/30 hover:border-[#FFFF00]/60 bg-[#FFFF00]/[0.04] hover:bg-[#FFFF00]/[0.08] text-[#FFFF00] text-sm font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t("brandCategory.addNewBrand")}
                </button>
              )}

              <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 pr-1">
                {filteredBrands.map((b: Brand) => (
                  editingBrandId === b.id ? (
                    <BrandForm
                      key={b.id}
                      companyId={companyId ?? ""}
                      initial={{ name: b.name, logoUrl: b.logoUrl }}
                      onSave={(data) => saveBrandEdit(b.id, data)}
                      onCancel={() => setEditingBrandId(null)}
                    />
                  ) : (
                    <div key={b.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/8 group transition-colors">
                      <BrandAvatar name={b.name} logoUrl={b.logoUrl} />
                      <span className="text-sm font-medium text-white truncate flex-1">{b.name}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1 rounded text-white/60 hover:text-[#FFFF00] transition-colors" onClick={() => { setEditingBrandId(b.id); setShowAddBrand(false); }}>
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button className="p-1 rounded text-white/60 hover:text-red-400 transition-colors" onClick={() => deleteBrand.mutate(b.id)}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                ))}
                {filteredBrands.length === 0 && (
                  <p className="px-2.5 py-3 text-xs text-white/40 italic">{tc("noResults")}</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
