import React from "react";
import { Tag } from "lucide-react";

const BRANDS = ["d&b audiotechnik", "Shure", "L-Acoustics", "Senheiser"];
const CATEGORIES = ["Speakers", "Cable", "Rigging", "Safety"];

interface StockFilterSidebarProps {
  selectedBrands: string[];
  selectedCategories: string[];
  onBrandChange: (brand: string) => void;
  onCategoryChange: (category: string) => void;
  onClearAll: () => void;
}

const CheckItem = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) => (
  <label className="flex items-center gap-3 group cursor-pointer py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors">
    <span
      className={`relative flex-shrink-0 w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center
        ${checked
          ? "border-[#FFFF00] bg-[#FFFF00]"
          : "border-white/20 bg-transparent group-hover:border-white/40"
        }`}
      onClick={onChange}
    >
      {checked && (
        <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 10 10" fill="none">
          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
    <span
      className={`text-sm transition-colors duration-150 ${
        checked ? "text-[#FFFF00] font-medium" : "text-white/50 group-hover:text-white/80"
      }`}
      onClick={onChange}
    >
      {label}
    </span>
  </label>
);

export const StockFilterSidebarSection = ({
  selectedBrands,
  selectedCategories,
  onBrandChange,
  onCategoryChange,
  onClearAll,
}: StockFilterSidebarProps): JSX.Element => {
  const totalSelected = selectedBrands.length + selectedCategories.length;

  return (
    <aside className="w-52 min-w-[208px] h-full bg-[#0d0d0d] border-r border-white/10 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-3.5 h-3.5 text-[#FFFF00]" />
          <span className="text-[10px] font-bold text-[#FFFF00] tracking-[0.15em] uppercase">
            Filter
          </span>
        </div>
        <p className="text-[10px] text-white/30 tracking-wide leading-tight">
          Brand &amp; Category
        </p>
        {totalSelected > 0 && (
          <button
            onClick={onClearAll}
            className="mt-2 text-[10px] text-white/30 hover:text-[#FFFF00] transition-colors underline underline-offset-2"
          >
            Clear all ({totalSelected})
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 px-2 py-4">
        {/* Brand section */}
        <div>
          <div className="px-2 mb-2 flex items-center gap-2">
            <span className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-semibold">
              Brand
            </span>
            {selectedBrands.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-black" style={{ backgroundColor: "#FFFF00" }}>
                {selectedBrands.length}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {BRANDS.map((brand) => (
              <CheckItem
                key={brand}
                label={brand}
                checked={selectedBrands.includes(brand)}
                onChange={() => onBrandChange(brand)}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/5 mx-2" />

        {/* Category section */}
        <div>
          <div className="px-2 mb-2 flex items-center gap-2">
            <span className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-semibold">
              Category
            </span>
            {selectedCategories.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-black" style={{ backgroundColor: "#FFFF00" }}>
                {selectedCategories.length}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {CATEGORIES.map((cat) => (
              <CheckItem
                key={cat}
                label={cat}
                checked={selectedCategories.includes(cat)}
                onChange={() => onCategoryChange(cat)}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
