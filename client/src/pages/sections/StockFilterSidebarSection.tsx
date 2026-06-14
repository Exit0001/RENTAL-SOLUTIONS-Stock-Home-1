import React, { useState } from "react";
import { Tag, Loader2, ChevronDown, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { catalogApi } from "@/api";

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
      className={`text-sm transition-colors duration-150 truncate ${
        checked ? "text-[#FFFF00] font-medium" : "text-white/50 group-hover:text-white/80"
      }`}
      onClick={onChange}
    >
      {label}
    </span>
  </label>
);

const SectionSkeleton = () => (
  <div className="flex flex-col gap-1 animate-pulse">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 py-1.5 px-2">
        <div className="w-4 h-4 rounded bg-white/[0.06] flex-shrink-0" />
        <div className="h-3 rounded bg-white/[0.05]" style={{ width: `${50 + (i * 13) % 40}%` }} />
      </div>
    ))}
  </div>
);

interface FilterSectionProps {
  title: string;
  isLoading: boolean;
  items: { id: string; name: string }[];
  selected: string[];
  onToggle: (name: string) => void;
  showSearch?: boolean;
}

const FilterSection = ({ title, isLoading, items, selected, onToggle, showSearch = false }: FilterSectionProps) => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState("");

  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <div>
      {/* Section header — click to collapse */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-2 mb-1 flex items-center gap-2 group"
      >
        <span className="text-[10px] text-white/60 uppercase tracking-[0.12em] font-semibold">
          {title}
        </span>
        {isLoading && <Loader2 className="w-3 h-3 text-white/60 animate-spin" />}
        {selected.length > 0 && !isLoading && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-black" style={{ backgroundColor: "#FFFF00" }}>
            {selected.length}
          </span>
        )}
        {!isLoading && (
          <span className="ml-auto text-white/60 text-[10px]">{items.length}</span>
        )}
        <ChevronDown
          className={`w-3 h-3 text-white/60 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && (
        <>
          {/* Search within section — only when list is long */}
          {showSearch && !isLoading && items.length > 8 && (
            <div className="relative mx-2 mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/60" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchSectionPlaceholder", { section: title.toLowerCase() })}
                className="w-full h-7 bg-white/[0.04] border border-white/[0.08] rounded-md pl-6 pr-6 text-[11px] text-white/60 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/30 focus:text-white transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-0.5">
            {isLoading ? (
              <SectionSkeleton />
            ) : filtered.length === 0 ? (
              <p className="px-2 py-2 text-[11px] text-white/60 italic">{tc("noResults")}</p>
            ) : (
              filtered.map((item) => (
                <CheckItem
                  key={item.id}
                  label={item.name}
                  checked={selected.includes(item.name)}
                  onChange={() => onToggle(item.name)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const StockFilterSidebarSection = ({
  selectedBrands,
  selectedCategories,
  onBrandChange,
  onCategoryChange,
  onClearAll,
}: StockFilterSidebarProps): JSX.Element => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ["catalog-brands"],
    queryFn: catalogApi.getBrands,
    enabled: !!token,
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["catalog-categories"],
    queryFn: catalogApi.getCategories,
    enabled: !!token,
  });

  const sortedBrands = [...brands].sort((a, b) => a.name.localeCompare(b.name));
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  const totalSelected = selectedBrands.length + selectedCategories.length;

  return (
    <aside className="w-52 min-w-[208px] h-full bg-[#0d0d0d] border-r border-white/10 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-3.5 h-3.5 text-[#FFFF00]" />
          <span className="text-[10px] font-bold text-[#FFFF00] tracking-[0.15em] uppercase">
            {tc("filter")}
          </span>
        </div>
        <p className="text-[10px] text-white/60 tracking-wide leading-tight">
          {t("brandAndCategory")}
        </p>
        {totalSelected > 0 && (
          <button
            onClick={onClearAll}
            className="mt-2 text-[10px] text-white/60 hover:text-[#FFFF00] transition-colors underline underline-offset-2"
          >
            {t("clearAllCount", { count: totalSelected })}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 px-2 py-4">
        <FilterSection
          title={tc("brand")}
          isLoading={brandsLoading}
          items={sortedBrands}
          selected={selectedBrands}
          onToggle={onBrandChange}
          showSearch
        />

        <div className="h-px bg-white/5 mx-2" />

        <FilterSection
          title={tc("category")}
          isLoading={catsLoading}
          items={sortedCategories}
          selected={selectedCategories}
          onToggle={onCategoryChange}
          showSearch={false}
        />
      </div>
    </aside>
  );
};
