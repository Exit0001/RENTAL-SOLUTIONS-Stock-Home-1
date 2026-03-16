import React, { useState } from "react";
import { X, Pencil, Trash2, Plus, Tag, Layers, GitBranch } from "lucide-react";

interface Brand { id: number; name: string; description: string; }
interface Category { id: number; name: string; }
interface SubCategory { id: number; name: string; parentCategory: string; }

const INITIAL_BRANDS: Brand[] = [
  { id: 1, name: "d&b audiotechnik", description: "Professional audio" },
  { id: 2, name: "L-Acoustics", description: "Line array systems" },
  { id: 3, name: "Shure", description: "Microphones & wireless" },
  { id: 4, name: "Senheiser", description: "Audio equipment" },
];

const INITIAL_CATEGORIES: Category[] = [
  { id: 1, name: "Speakers" },
  { id: 2, name: "Cable" },
  { id: 3, name: "Rigging" },
  { id: 4, name: "Safety" },
];

const INITIAL_SUBCATEGORIES: SubCategory[] = [
  { id: 1, name: "Line Array", parentCategory: "Speakers" },
  { id: 2, name: "Moving Heads", parentCategory: "Rigging" },
  { id: 3, name: "LED Walls", parentCategory: "Speakers" },
  { id: 4, name: "Ground Stacks", parentCategory: "Rigging" },
];

const avatarColors = [
  "#FFFF00", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FECA57", "#FF9FF3", "#54A0FF", "#5F27CD", "#00D2D3",
];
const getBgColor = (name: string) =>
  avatarColors[name.charCodeAt(0) % avatarColors.length];

const BrandAvatar = ({ name }: { name: string }) => (
  <span
    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black flex-shrink-0"
    style={{ backgroundColor: getBgColor(name) }}
  >
    {name.charAt(0).toUpperCase()}
  </span>
);

interface AddFormProps {
  fields: { key: string; label: string; placeholder: string }[];
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
}
const AddForm = ({ fields, onSave, onCancel }: AddFormProps) => {
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, ""]))
  );
  return (
    <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-2 animate-modal-up">
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label className="text-[10px] text-white/40 uppercase tracking-wider">{f.label}</label>
          <input
            value={vals[f.key]}
            onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className="h-8 px-3 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/50 transition-colors"
          />
        </div>
      ))}
      <div className="flex gap-2 mt-1">
        <button
          onClick={onCancel}
          className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/30 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { onSave(vals); }}
          className="flex-1 h-8 rounded-lg text-xs font-bold text-black transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#FFFF00" }}
        >
          Save
        </button>
      </div>
    </div>
  );
};

interface BrandCategoryModalProps {
  onClose: () => void;
}

export const BrandCategoryModal = ({ onClose }: BrandCategoryModalProps): JSX.Element => {
  const [brands, setBrands] = useState<Brand[]>(INITIAL_BRANDS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [subCategories, setSubCategories] = useState<SubCategory[]>(INITIAL_SUBCATEGORIES);

  const [showAddBrand, setShowAddBrand] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);

  const addBrand = (data: Record<string, string>) => {
    if (!data.name.trim()) return;
    setBrands((p) => [...p, { id: Date.now(), name: data.name, description: data.description }]);
    setShowAddBrand(false);
  };

  const addCategory = (data: Record<string, string>) => {
    if (!data.name.trim()) return;
    setCategories((p) => [...p, { id: Date.now(), name: data.name }]);
    setShowAddCategory(false);
  };

  const addSub = (data: Record<string, string>) => {
    if (!data.name.trim()) return;
    setSubCategories((p) => [...p, { id: Date.now(), name: data.name, parentCategory: data.parentCategory }]);
    setShowAddSub(false);
  };

  const deleteItem = <T extends { id: number }>(id: number, setter: React.Dispatch<React.SetStateAction<T[]>>) =>
    setter((p) => p.filter((x) => x.id !== id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl bg-[#111111] rounded-2xl border border-white/10 shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FFFF00" }}>
              <Tag className="w-4 h-4 text-black" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide">Brand &amp; Category Management</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
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
              <h3 className="text-sm font-bold text-white tracking-wide">Brand Management</h3>
              <span className="ml-auto text-[10px] text-white/25 uppercase tracking-wider">{brands.length} brands</span>
            </div>

            <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 pr-1">
              {brands.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/8 group transition-colors"
                >
                  <BrandAvatar name={b.name} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium text-white truncate">{b.name}</span>
                    {b.description && (
                      <span className="text-[10px] text-white/30 truncate">{b.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 rounded text-white/30 hover:text-[#FFFF00] transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      className="p-1 rounded text-white/30 hover:text-red-400 transition-colors"
                      onClick={() => deleteItem(b.id, setBrands)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {showAddBrand && (
                <AddForm
                  fields={[
                    { key: "name", label: "Brand Name", placeholder: "e.g. Pioneer DJ" },
                    { key: "description", label: "Description", placeholder: "Optional description" },
                  ]}
                  onSave={addBrand}
                  onCancel={() => setShowAddBrand(false)}
                />
              )}
            </div>

            {!showAddBrand && (
              <button
                onClick={() => setShowAddBrand(true)}
                className="mt-3 w-full h-9 rounded-xl border border-dashed border-white/15 hover:border-[#FFFF00]/50 text-white/30 hover:text-[#FFFF00] text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Brand
              </button>
            )}
          </div>

          {/* --- CATEGORY MANAGEMENT --- */}
          <div className="flex-1 flex flex-col border-r border-white/10 p-4 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-3.5 h-3.5 text-[#FFFF00]" />
              <h3 className="text-sm font-bold text-white tracking-wide">Category Management</h3>
              <span className="ml-auto text-[10px] text-white/25 uppercase tracking-wider">{categories.length} cats</span>
            </div>

            <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 pr-1">
              {categories.map((c, i) => (
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
                    <button className="p-1 rounded text-white/30 hover:text-[#FFFF00] transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      className="p-1 rounded text-white/30 hover:text-red-400 transition-colors"
                      onClick={() => deleteItem(c.id, setCategories)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {showAddCategory && (
                <AddForm
                  fields={[
                    { key: "name", label: "Category Name", placeholder: "e.g. Lighting" },
                  ]}
                  onSave={addCategory}
                  onCancel={() => setShowAddCategory(false)}
                />
              )}
            </div>

            {!showAddCategory && (
              <button
                onClick={() => setShowAddCategory(true)}
                className="mt-3 w-full h-9 rounded-xl border border-dashed border-white/15 hover:border-[#FFFF00]/50 text-white/30 hover:text-[#FFFF00] text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Category
              </button>
            )}
          </div>

          {/* --- SUB-CATEGORY MANAGEMENT --- */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-3.5 h-3.5 text-[#FFFF00]" />
              <h3 className="text-sm font-bold text-white tracking-wide">Sub-Category</h3>
              <span className="ml-auto text-[10px] text-white/25 uppercase tracking-wider">{subCategories.length} subs</span>
            </div>

            <div className="flex flex-col gap-1 flex-1 overflow-y-auto min-h-0 pr-1">
              {subCategories.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/8 group transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFFF00]/60 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-white flex-1 truncate">{s.name}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1 rounded text-white/30 hover:text-[#FFFF00] transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 rounded text-white/30 hover:text-red-400 transition-colors"
                        onClick={() => deleteItem(s.id, setSubCategories)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-white/25 pl-3.5">↳ {s.parentCategory}</span>
                </div>
              ))}

              {showAddSub && (
                <AddForm
                  fields={[
                    { key: "name", label: "Sub-Category Name", placeholder: "e.g. Line Array" },
                    { key: "parentCategory", label: "Parent Category", placeholder: "e.g. Speakers" },
                  ]}
                  onSave={addSub}
                  onCancel={() => setShowAddSub(false)}
                />
              )}
            </div>

            {!showAddSub && (
              <button
                onClick={() => setShowAddSub(true)}
                className="mt-3 w-full h-9 rounded-xl border border-dashed border-white/15 hover:border-[#FFFF00]/50 text-white/30 hover:text-[#FFFF00] text-sm font-medium flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Sub-Category
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
