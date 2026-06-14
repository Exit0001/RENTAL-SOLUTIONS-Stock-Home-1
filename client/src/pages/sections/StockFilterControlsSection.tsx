import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, Plus, Tag, Layers, MapPin, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StockFilterControlsProps {
  filterOpen: boolean;
  onToggleFilter: () => void;
  onOpenBrandCategory: () => void;
  onOpenAddLocation: () => void;
  onOpenAddNewItem: () => void;
  onOpenAddIndividualUnit: () => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
}

export const StockFilterControlsSection = ({
  filterOpen,
  onToggleFilter,
  onOpenBrandCategory,
  onOpenAddLocation,
  onOpenAddNewItem,
  onOpenAddIndividualUnit,
  searchQuery,
  onSearchChange,
}: StockFilterControlsProps): JSX.Element => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  return (
    <div className="flex flex-row items-center gap-3 w-full px-4 py-3 border-b border-white/10 bg-[#0f0f0f] flex-shrink-0 animate-fade-in" style={{ animationDelay: "150ms" }}>
      <Button
        onClick={onToggleFilter}
        className={`h-9 px-4 rounded-lg font-semibold text-sm gap-2 transition-all border ${
          filterOpen
            ? "text-black border-[#FFFF00]"
            : "bg-white/10 hover:bg-white/20 text-white border-white/20"
        }`}
        style={filterOpen ? { backgroundColor: "#FFFF00" } : {}}
        variant="ghost"
      >
        <SlidersHorizontal className="w-4 h-4" />
        {tc("filter")}
      </Button>

      <div className="relative flex items-center h-9 flex-1 max-w-xs bg-[#FFFF00]/10 border border-[#FFFF00]/20 rounded-lg focus-within:border-[#FFFF00]/50 transition-colors">
        <Search className="absolute left-3 w-4 h-4 text-[#FFFF00]/60" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("searchItemsPlaceholder")}
          className="w-full h-full bg-transparent pl-9 pr-3 text-sm text-white/70 placeholder:text-white/60 focus:outline-none focus:text-white transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          onClick={onOpenBrandCategory}
          className="h-9 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg font-semibold text-sm gap-2 transition-colors"
          variant="ghost"
        >
          <Tag className="w-4 h-4" />
          {t("addBrandCategory")}
        </Button>

        <Button
          onClick={onOpenAddLocation}
          className="h-9 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg font-semibold text-sm gap-2 transition-colors"
          variant="ghost"
        >
          <MapPin className="w-4 h-4" />
          {t("addLocation")}
        </Button>

        <Button
          onClick={onOpenAddNewItem}
          className="h-9 px-4 hover:opacity-90 text-black rounded-lg font-bold text-sm gap-2 transition-opacity"
          style={{ backgroundColor: "#FFFF00" }}
          variant="ghost"
        >
          <Plus className="w-4 h-4" />
          {t("addNewItem")}
        </Button>

        <Button
          onClick={onOpenAddIndividualUnit}
          className="h-9 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg font-semibold text-sm gap-2 transition-colors"
          variant="ghost"
        >
          <Layers className="w-4 h-4" />
          {t("addIndividualUnit")}
        </Button>
      </div>
    </div>
  );
};
