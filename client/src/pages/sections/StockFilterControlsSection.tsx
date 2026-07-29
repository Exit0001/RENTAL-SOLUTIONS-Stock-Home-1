import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, Plus, Tag, MapPin, X, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";

interface StockFilterControlsProps {
  filterOpen: boolean;
  onToggleFilter: () => void;
  onOpenBrandCategory: () => void;
  onOpenAddLocation: () => void;
  onOpenQuickAdd: () => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
}

export const StockFilterControlsSection = ({
  filterOpen,
  onToggleFilter,
  onOpenBrandCategory,
  onOpenAddLocation,
  onOpenQuickAdd,
  searchQuery,
  onSearchChange,
}: StockFilterControlsProps): JSX.Element => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  return (
    // Mobile is ONE row of icon buttons around a flexible search field — the previous
    // horizontally-scrolling strip of five full-width buttons meant swiping just to
    // reach "add item". The two secondary "add" actions move into the ⋯ menu; the
    // primary one stays visible as a brand-coloured + button.
    <div className="flex items-center gap-2 md:gap-3 w-full px-3 md:px-4 py-2 md:py-3 border-b border-fg/[0.06] bg-surface-1 flex-shrink-0 animate-fade-in" style={{ animationDelay: "150ms" }}>
      <button
        onClick={onToggleFilter}
        aria-label={tc("filter")}
        className={`flex items-center justify-center md:justify-start gap-2 w-11 md:w-auto h-11 md:h-9 md:px-4 rounded-xl md:rounded-lg font-semibold text-sm transition-all border flex-shrink-0 ${
          filterOpen ? "text-black border-brand" : "bg-fg/10 hover:bg-fg/20 text-fg border-fg/20"
        }`}
        style={filterOpen ? { backgroundColor: "var(--brand)" } : {}}
      >
        <SlidersHorizontal className="w-[18px] h-[18px] md:w-4 md:h-4" aria-hidden="true" />
        <span className="hidden md:inline">{tc("filter")}</span>
      </button>

      <div className="relative flex items-center h-11 md:h-9 flex-1 min-w-0 md:max-w-xs bg-brand/10 border border-brand/20 rounded-xl md:rounded-lg focus-within:border-brand/50 transition-colors">
        <Search className="absolute left-3 w-4 h-4 text-brand/60 pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("searchItemsPlaceholder")}
          aria-label={t("searchItemsPlaceholder")}
          className="w-full h-full bg-transparent pl-9 pr-9 text-sm text-fg/80 placeholder:text-fg/50 focus:outline-none focus:text-fg transition-colors rounded-xl md:rounded-lg"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            aria-label={tc("cancel")}
            className="absolute right-2 w-7 h-7 flex items-center justify-center rounded-full text-fg/60 hover:text-fg hover:bg-fg/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <button
        onClick={onOpenQuickAdd}
        aria-label={t("addNewItem")}
        className="flex items-center justify-center md:justify-start gap-2 w-11 md:w-auto h-11 md:h-9 md:px-4 hover:opacity-90 text-black rounded-xl md:rounded-lg font-bold text-sm transition-opacity flex-shrink-0"
        style={{ backgroundColor: "var(--brand)" }}
      >
        <Plus className="w-5 h-5 md:w-4 md:h-4" aria-hidden="true" />
        <span className="hidden md:inline">{t("addNewItem")}</span>
      </button>

      {/* Secondary actions — visible buttons on desktop, ⋯ menu on mobile.
          Same two handlers either way, so nothing becomes unreachable. */}
      <div className="hidden md:flex items-center gap-2">
        <Button
          onClick={onOpenBrandCategory}
          className="h-9 px-4 bg-fg/10 hover:bg-fg/20 text-fg border border-fg/20 rounded-lg font-semibold text-sm gap-2 transition-colors"
          variant="ghost"
        >
          <Tag className="w-4 h-4" aria-hidden="true" />
          {t("addBrandCategory")}
        </Button>
        <Button
          onClick={onOpenAddLocation}
          className="h-9 px-4 bg-fg/10 hover:bg-fg/20 text-fg border border-fg/20 rounded-lg font-semibold text-sm gap-2 transition-colors"
          variant="ghost"
        >
          <MapPin className="w-4 h-4" aria-hidden="true" />
          {t("addLocation")}
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={tc("more", { defaultValue: "เพิ่มเติม" })}
            className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl bg-fg/10 hover:bg-fg/20 text-fg border border-fg/20 transition-colors flex-shrink-0"
          >
            <MoreHorizontal className="w-[18px] h-[18px]" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-surface-1 border-fg/10">
          <DropdownMenuItem onClick={onOpenBrandCategory} className="gap-2 py-3 text-sm text-fg/80 focus:text-fg focus:bg-fg/[0.06] cursor-pointer">
            <Tag className="w-4 h-4 text-brand" aria-hidden="true" />
            {t("addBrandCategory")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenAddLocation} className="gap-2 py-3 text-sm text-fg/80 focus:text-fg focus:bg-fg/[0.06] cursor-pointer">
            <MapPin className="w-4 h-4 text-brand" aria-hidden="true" />
            {t("addLocation")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
