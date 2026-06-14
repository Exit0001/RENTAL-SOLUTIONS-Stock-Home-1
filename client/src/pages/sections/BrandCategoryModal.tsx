import React, { useState } from "react";
import { X, Pencil, Trash2, Plus, Tag, Layers, GitBranch } from "lucide-react";
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

interface AddFormProps {
  fields: { key: string; label: string; placeholder: string }[];
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
}
const AddForm = ({ fields, onSave, onCancel }: AddFormProps) => {
  const { t: tc } = useTranslation("common");
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, ""]))
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

  const createCategory = useMutation({
    mutationFn: catalogApi.createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "categories"] }),
  });
  const deleteCategory = useMutation({
    mutationFn: catalogApi.deleteCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "categories"] }),
  });

  const createSubCategory = useMutation({
    mutationFn: catalogApi.createSubCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "subcategories"] }),
  });
  const deleteSubCategory = useMutation({
    mutationFn: catalogApi.deleteSubCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "subcategories"] }),
  });

  const [showAddBrand, setShowAddBrand] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);

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

  const addSub = (data: { name: string; parentCategory: string }) => {
    if (!data.name.trim()) return;
    createSubCategory.mutate({ name: data.name.trim(), parentCategory: data.parentCategory.trim() });
    setShowAddSub(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl bg-[#111111] rounded-2xl border border-white/10 shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">
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

        {/* Three panels */}
        <div className="flex flex-row gap-0 flex-1 overflow-hidden">
          {/* --- BRAND MANAGEMENT --- */}
          <div className="flex-1 flex flex-col border-r border-white/10 p-4 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-3.5 h-3.5 text-[#FFFF00]" />
              <h3 className="text-sm font-bold text-white tracking-wide">{t("brandCategory.brandManagement")}</h3>
              <span className="ml-auto text-[10px] text-white/60 uppercase tracking-wider">{t("brandCategory.brandsCount", { count: brands.length })}</span>
            </div>

            <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 pr-1">
              {brands.map((b: Brand) => (
                editingBrandId === b.id ? (
                  <BrandForm
                    key={b.id}
                    companyId={companyId ?? ""}
                    initial={{ name: b.name, logoUrl: b.logoUrl }}
                    onSave={(data) => saveBrandEdit(b.id, data)}
                    onCancel={() => setEditingBrandId(null)}
                  />
                ) : (
                  <div
                    key={b.id}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/8 group transition-colors"
                  >
                    <BrandAvatar name={b.name} logoUrl={b.logoUrl} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium text-white truncate">{b.name}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded text-white/60 hover:text-[#FFFF00] transition-colors"
                        onClick={() => { setEditingBrandId(b.id); setShowAddBrand(false); }}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 rounded text-white/60 hover:text-red-400 transition-colors"
                        onClick={() => deleteBrand.mutate(b.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              ))}

              {showAddBrand && (
                <BrandForm
                  companyId={companyId ?? ""}
                  onSave={addBrand}
                  onCancel={() => setShowAddBrand(false)}
                />
              )}
            </div>

            {!showAddBrand && (
              <button
                onClick={() => { setShowAddBrand(true); setEditingBrandId(null); }}
                className="mt-3 w-full h-9 rounded-xl border border-dashed border-white/15 hover:border-[#FFFF00]/50 text-white/60 hover:text-[#FFFF00] text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("brandCategory.addNewBrand")}
              </button>
            )}
          </div>

          {/* --- CATEGORY MANAGEMENT --- */}
          <div className="flex-1 flex flex-col border-r border-white/10 p-4 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-3.5 h-3.5 text-[#FFFF00]" />
              <h3 className="text-sm font-bold text-white tracking-wide">{t("brandCategory.categoryManagement")}</h3>
              <span className="ml-auto text-[10px] text-white/60 uppercase tracking-wider">{t("brandCategory.categoriesCount", { count: categories.length })}</span>
            </div>

            <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 pr-1">
              {categories.map((c: Category, i: number) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/8 group transition-colors"
                >
                  <span
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0"
                    style={{ backgroundColor: avatarColors[i % avatarColors.length] }}
                  >
                    {(i + 1).toString().padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium text-white flex-1 truncate">{c.name}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="p-1 rounded text-white/60 hover:text-red-400 transition-colors"
                      onClick={() => deleteCategory.mutate(c.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {showAddCategory && (
                <AddForm
                  fields={[
                    { key: "name", label: t("brandCategory.categoryNameLabel"), placeholder: t("brandCategory.categoryNamePlaceholder") },
                  ]}
                  onSave={addCategory}
                  onCancel={() => setShowAddCategory(false)}
                />
              )}
            </div>

            {!showAddCategory && (
              <button
                onClick={() => setShowAddCategory(true)}
                className="mt-3 w-full h-9 rounded-xl border border-dashed border-white/15 hover:border-[#FFFF00]/50 text-white/60 hover:text-[#FFFF00] text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("brandCategory.addNewCategory")}
              </button>
            )}
          </div>

          {/* --- SUB-CATEGORY MANAGEMENT --- */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-3.5 h-3.5 text-[#FFFF00]" />
              <h3 className="text-sm font-bold text-white tracking-wide">{t("brandCategory.subCategoryManagement")}</h3>
              <span className="ml-auto text-[10px] text-white/60 uppercase tracking-wider">{t("brandCategory.subsCount", { count: subCategories.length })}</span>
            </div>

            <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 pr-1">
              {subCategories.map((s: SubCategory) => (
                <div
                  key={s.id}
                  className="flex flex-col px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/8 group transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFFF00]/60 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-white flex-1 truncate">{s.name}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded text-white/60 hover:text-red-400 transition-colors"
                        onClick={() => deleteSubCategory.mutate(s.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-white/60 pl-3.5">↳ {s.parentCategory}</span>
                </div>
              ))}

              {showAddSub && (
                <SubCategoryForm
                  categoryOptions={categories.map((c: Category) => c.name)}
                  onSave={addSub}
                  onCancel={() => setShowAddSub(false)}
                />
              )}
            </div>

            {!showAddSub && (
              <button
                onClick={() => setShowAddSub(true)}
                className="mt-3 w-full h-9 rounded-xl border border-dashed border-white/15 hover:border-[#FFFF00]/50 text-white/60 hover:text-[#FFFF00] text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("brandCategory.addNewSubCategory")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
