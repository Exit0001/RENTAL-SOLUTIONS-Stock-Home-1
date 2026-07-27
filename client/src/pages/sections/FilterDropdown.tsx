import React, { useState } from "react";
import { ChevronDown, Check, X as XIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { ChipOption } from "./FilterChipRow";

interface Props {
  label:      string;
  options:    ChipOption[];
  activeKey:  string | null;
  onSelect:   (key: string | null) => void;
}

// Single-select filter as a dropdown checklist — keeps Brand/Sub-Category filters to
// one compact button each regardless of how many options exist, instead of a wrapping
// chip row. Category stays as a plain chip row (FilterChipRow) since it's the primary,
// most-used filter with far fewer values.
export const FilterDropdown = ({ label, options, activeKey, onSelect }: Props): JSX.Element => {
  const [open, setOpen] = useState(false);
  const active = options.find((o) => o.key === activeKey);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`h-7 px-2.5 rounded-full text-[11px] font-semibold transition-colors border flex items-center gap-1.5
            ${active ? "bg-fg text-black border-fg" : "text-fg/60 border-fg/10 hover:border-fg/30"}`}
        >
          <span className="truncate max-w-[110px]">{active ? active.label : label}</span>
          {active ? (
            <span
              onClick={(e) => { e.stopPropagation(); onSelect(null); }}
              className="hover:text-red-500 flex-shrink-0"
            >
              <XIcon className="w-3 h-3" />
            </span>
          ) : (
            <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 max-h-64 overflow-y-auto bg-surface-2 border border-fg/10 rounded-xl p-1.5 shadow-2xl"
      >
        {options.map((opt) => (
          <button
            key={opt.key}
            onClick={() => { onSelect(activeKey === opt.key ? null : opt.key); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-colors
              ${activeKey === opt.key ? "bg-brand/10 text-brand" : "text-fg/70 hover:bg-fg/[0.06]"}`}
          >
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0
              ${activeKey === opt.key ? "border-brand bg-brand" : "border-fg/20"}`}>
              {activeKey === opt.key && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
            </span>
            <span className="flex-1 truncate">{opt.label}</span>
            <span className="text-fg/40">{opt.count}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
