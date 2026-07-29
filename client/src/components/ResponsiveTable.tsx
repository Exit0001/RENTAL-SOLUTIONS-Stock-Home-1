import type { ReactNode } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";

// Renders exactly ONE branch (never both) — see SKILL.md §1/P4 for why dual
// render is a correctness bug here, not just a perf concern: this app's
// tables carry data-testid/id per row, and duplicating them breaks label
// association and test selectors.
interface ResponsiveTableProps {
  /** the existing <table>/<Table> element, unchanged */
  table: ReactNode;
  /** stacked <DataCard> list for mobile */
  cards: ReactNode;
  /** tier at which `table` takes over from `cards`. Default "md" (tablet+desktop see the table). */
  breakpoint?: "md" | "lg";
  className?: string;
}

export const ResponsiveTable = ({ table, cards, breakpoint = "md", className = "" }: ResponsiveTableProps): JSX.Element => {
  const { isMobile, isMobileOrTablet } = useBreakpoint();
  const showCards = breakpoint === "lg" ? isMobileOrTablet : isMobile;

  return <div className={className}>{showCards ? <div className="flex flex-col gap-2.5">{cards}</div> : table}</div>;
};
