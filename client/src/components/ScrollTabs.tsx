import { useEffect, useRef, type ComponentType, type ReactNode } from "react";

// The fix for every horizontally-overflowing tab bar in the app (StockPage had
// 6 tabs and no overflow-x-auto — the worst offender). See
// .claude/skills/stak-mobile-responsive/SKILL.md §5/§6.
//
// variant="underline" — page-level tab bars (JobDetailPanel.tsx:152 is the
//   existing correct pattern this was lifted from)
// variant="pill"      — WorkspaceShell-style header tabs

export interface ScrollTab<K extends string = string> {
  key: K;
  label: ReactNode;
  Icon?: ComponentType<{ className?: string }>;
  count?: number;
  badge?: ReactNode;
}

interface ScrollTabsProps<K extends string> {
  tabs: ScrollTab<K>[];
  active: K;
  onChange: (key: K) => void;
  variant?: "underline" | "pill";
  size?: "sm" | "md";
  className?: string;
  testIdPrefix?: string;
}

export function ScrollTabs<K extends string>({
  tabs,
  active,
  onChange,
  variant = "underline",
  size = "sm",
  className = "",
  testIdPrefix,
}: ScrollTabsProps<K>): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the active tab in view when it changes (e.g. programmatic selection,
  // or restoring state after a back-navigation) — otherwise tab 6 of 6 can be
  // stranded off-screen with no visual hint that more tabs exist.
  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLButtonElement>(`[data-tab-key="${active}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [active]);

  const isPill = variant === "pill";
  const heightCx = size === "md" ? "md:h-9" : "md:h-8";

  return (
    // The wrapper exists only to host the right-edge fade: with scrollbars hidden
    // app-wide (index.css), a scrollable tab strip otherwise looks like it simply
    // ends, and users never discover tabs 5-6.
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        role="tablist"
        className="h-scroll snap-x snap-proximity flex items-stretch gap-0.5 md:gap-1 whitespace-nowrap pr-8 md:pr-0"
      >
        {tabs.map((tb) => {
          const isActive = active === tb.key;
          // Mobile gets 48px-tall, 13px-text targets; desktop keeps the original
          // compact 12px sizing so nothing shifts on large screens.
          const cx = isPill
            ? `flex items-center gap-2 px-4 min-h-[48px] ${heightCx} rounded-lg text-[13px] md:text-sm font-bold transition-colors flex-shrink-0 snap-start ${
                isActive ? "bg-brand text-black" : "text-fg/60 hover:text-fg hover:bg-fg/5"
              }`
            : `flex items-center gap-1.5 px-3.5 md:px-3 min-h-[48px] md:min-h-0 md:py-2 text-[13px] md:text-xs font-semibold md:font-medium border-b-2 transition-colors flex-shrink-0 snap-start ${
                isActive ? "border-brand text-brand" : "border-transparent text-fg/50 hover:text-fg"
              }`;
          return (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-tab-key={tb.key}
              onClick={() => onChange(tb.key)}
              className={cx}
              data-testid={testIdPrefix ? `${testIdPrefix}-${tb.key}` : undefined}
            >
              {tb.Icon && <tb.Icon className="w-4 h-4 md:w-3.5 md:h-3.5 flex-shrink-0" aria-hidden="true" />}
              {tb.label}
              {tb.badge != null
                ? tb.badge
                : typeof tb.count === "number" && (
                    <span className={`text-[11px] md:text-[10px] ${isActive ? (isPill ? "text-black/60" : "text-brand/70") : "text-fg/40"}`}>
                      {tb.count}
                    </span>
                  )}
            </button>
          );
        })}
      </div>
      <div className="scroll-fade-r md:hidden" aria-hidden="true" />
    </div>
  );
}
