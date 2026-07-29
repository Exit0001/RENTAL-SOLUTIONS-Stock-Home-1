import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";

// The fix for every "fixed-width list + flex-1 detail" layout that leaves the
// detail pane with ~30px on a phone (JobsPage, CrewPage's roster<->callsheet
// leg). See SKILL.md §5.1.
//
// Why JS and not CSS: the detail pane often owns its own TanStack Query hooks
// (e.g. JobDetailPanel). Rendering it `hidden` on mobile would still fire real
// network requests for a pane the user cannot see — so on mobile the inactive
// side must not be mounted at all, which CSS visibility can't do.
interface MasterDetailProps {
  master: ReactNode;
  detail: ReactNode;
  /** mobile only: is the detail pane pushed on top of the list? */
  detailOpen: boolean;
  onBack: () => void;
  detailTitle?: ReactNode;
  masterClassName?: string;
  className?: string;
}

export const MasterDetail = ({
  master,
  detail,
  detailOpen,
  onBack,
  detailTitle,
  masterClassName = "w-full md:w-[280px] lg:w-[320px]",
  className = "",
}: MasterDetailProps): JSX.Element => {
  const { isMobile } = useBreakpoint();

  if (isMobile) {
    if (detailOpen) {
      return (
        <div className={`flex flex-col h-full min-h-0 ${className}`}>
          <div className="flex items-center gap-2 px-2 py-2 border-b border-fg/[0.06] flex-shrink-0 bg-surface-1">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 h-9 px-2 rounded-lg text-sm font-medium text-fg/70 hover:text-fg hover:bg-fg/5 transition-colors tap-target flex-shrink-0"
              aria-label="Back"
              data-testid="button-master-detail-back"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            {detailTitle && <div className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{detailTitle}</div>}
          </div>
          <div className="flex-1 min-h-0">{detail}</div>
        </div>
      );
    }
    return <div className={`h-full min-h-0 ${className}`}>{master}</div>;
  }

  return (
    <div className={`flex flex-1 min-h-0 ${className}`}>
      <div className={`${masterClassName} flex-shrink-0 min-h-0`}>{master}</div>
      <div className="flex-1 min-w-0 min-h-0">{detail}</div>
    </div>
  );
};
