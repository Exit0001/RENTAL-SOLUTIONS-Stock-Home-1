import type { ComponentType, ReactNode } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { ScrollTabs } from "./ScrollTabs";

// For the 2-pane bodies that live INSIDE a WorkspaceShell's `children`
// (catalog|cart splits) — not the shell's own `sidebar` prop, which
// WorkspaceShell handles itself via `mobilePanes`. See SKILL.md §1/P7.
//
// Desktop/tablet: renders every pane in a flex row, each keeping its own
// existing width classes — byte-identical to the pre-mobile layout.
// Mobile: a ScrollTabs strip + only the active pane, full width.
//
// `keepMounted` is a correctness requirement, not an optimization: panes
// holding uncommitted local state (e.g. a search string) must be hidden with
// `hidden`, never unmounted, or switching tabs silently clears what the user
// typed. Default true.
export interface PaneTabsEntry {
  key: string;
  label: string;
  Icon?: ComponentType<{ className?: string }>;
  badge?: ReactNode;
  node: ReactNode;
  keepMounted?: boolean;
}

interface PaneTabsProps {
  panes: PaneTabsEntry[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export const PaneTabs = ({ panes, active, onChange, className = "" }: PaneTabsProps): JSX.Element => {
  const { isMobile } = useBreakpoint();

  if (!isMobile) {
    return <div className={`flex flex-1 min-h-0 ${className}`}>{panes.map((p) => <div key={p.key} className="contents">{p.node}</div>)}</div>;
  }

  return (
    <div className={`flex flex-col flex-1 min-h-0 ${className}`}>
      <ScrollTabs
        tabs={panes.map((p) => ({ key: p.key, label: p.label, Icon: p.Icon, badge: p.badge }))}
        active={active}
        onChange={onChange}
        variant="pill"
        className="px-3 py-2 border-b border-fg/[0.06] flex-shrink-0"
      />
      <div className="flex-1 min-h-0 flex flex-col">
        {panes.map((p) => {
          const isActive = p.key === active;
          const keepMounted = p.keepMounted !== false;
          if (!isActive && !keepMounted) return null;
          return (
            <div key={p.key} className={`flex-1 min-h-0 flex flex-col ${isActive ? "" : "hidden"}`}>
              {p.node}
            </div>
          );
        })}
      </div>
    </div>
  );
};
