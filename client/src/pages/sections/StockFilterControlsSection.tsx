import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, Plus, Tag } from "lucide-react";

export const StockFilterControlsSection = (): JSX.Element => {
  return (
    <div className="flex flex-row items-center gap-3 w-full px-4 py-3 border-b border-white/10 bg-[#0f0f0f] flex-shrink-0 animate-fade-in" style={{ animationDelay: "150ms" }}>
      <Button
        className="h-9 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg font-semibold text-sm gap-2 transition-colors"
        variant="ghost"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filter
      </Button>

      <div className="relative flex items-center h-9 flex-1 max-w-xs bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
        <Search className="absolute left-3 w-4 h-4 text-yellow-400/60" />
        <input
          type="text"
          placeholder="Search for items..."
          className="w-full h-full bg-transparent pl-9 pr-3 text-sm text-white/70 placeholder:text-white/30 focus:outline-none focus:text-white transition-colors"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <Button
          className="h-9 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg font-semibold text-sm gap-2 transition-colors"
          variant="ghost"
        >
          <Tag className="w-4 h-4" />
          Add Brand &amp; Category
        </Button>

        <Button
          className="h-9 px-4 bg-yellow-400 hover:bg-yellow-300 text-black rounded-lg font-bold text-sm gap-2 transition-colors"
          variant="ghost"
        >
          <Plus className="w-4 h-4" />
          Add New Item
        </Button>
      </div>
    </div>
  );
};
