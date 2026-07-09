import React, { useMemo, useState } from "react";

export interface ChipOption { key: string; label: string; count: number }

interface Props {
  options:     ChipOption[];
  activeKey:   string | null;
  onSelect:    (key: string | null) => void;
  variant?:    "primary" | "secondary";
  maxVisible?: number;
  moreLabel:   (count: number) => string;
  lessLabel:   string;
}

// Renders a row of toggle chips capped at `maxVisible`, with a "+N more" chip to
// reveal the rest — keeps catalogs with many brands/categories from wrapping to
// several lines. The active chip is always kept visible even while collapsed.
export const FilterChipRow = ({
  options, activeKey, onSelect, variant = "secondary", maxVisible = 8, moreLabel, lessLabel,
}: Props): JSX.Element => {
  const [expanded, setExpanded] = useState(false);

  const ordered = useMemo(() => {
    if (!activeKey) return options;
    const idx = options.findIndex((o) => o.key === activeKey);
    if (idx <= 0) return options;
    const copy = [...options];
    const [item] = copy.splice(idx, 1);
    return [item, ...copy];
  }, [options, activeKey]);

  const visible = expanded ? ordered : ordered.slice(0, maxVisible);
  const hiddenCount = ordered.length - visible.length;

  const activeCls = variant === "primary"
    ? "bg-[#FFFF00] text-black border-[#FFFF00]"
    : "bg-white text-black border-white";
  const sizeCls = variant === "primary" ? "h-7 px-2.5 text-[11px]" : "h-6 px-2 text-[10px]";

  return (
    <>
      {visible.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onSelect(activeKey === opt.key ? null : opt.key)}
          className={`${sizeCls} rounded-full font-semibold transition-colors border
            ${activeKey === opt.key ? activeCls : "text-white/60 border-white/10 hover:border-white/30"}`}
        >
          {opt.label} <span className="opacity-60">{opt.count}</span>
        </button>
      ))}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="h-6 px-2 rounded-full text-[10px] text-white/40 border border-white/10 hover:border-white/30 hover:text-white/70 transition-colors"
        >
          {moreLabel(hiddenCount)}
        </button>
      )}
      {expanded && ordered.length > maxVisible && (
        <button
          onClick={() => setExpanded(false)}
          className="h-6 px-2 rounded-full text-[10px] text-white/40 border border-white/10 hover:border-white/30 hover:text-white/70 transition-colors"
        >
          {lessLabel}
        </button>
      )}
    </>
  );
};
