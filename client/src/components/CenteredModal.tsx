import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

// The fix for the ~24 hand-rolled centered dialogs in pages/sections/. On
// mobile this renders as a full-width bottom sheet (items-end + rounded-t-2xl)
// with NO new dependency (vaul is deliberately not used — see SKILL.md §1).
// On tablet/desktop it is byte-compatible with the existing centered-card
// pattern (`fixed inset-0 ... p-4` + `rgba(0,0,0,0.85)` backdrop + `max-w-*`).
//
// For the 2-3 files whose internals resist wrapping (ItemDetailPanel,
// UnitDetailModal), use the exported MODAL_CX class strings directly instead.

const SIZE_CX: Record<NonNullable<CenteredModalProps["size"]>, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
};

export const MODAL_CX = {
  overlay: "fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4",
  backdrop: { backgroundColor: "rgba(0,0,0,0.85)" } as const,
  card: "w-full max-h-[100dvh] sm:max-h-[90dvh] rounded-t-2xl sm:rounded-2xl bg-surface-1 border border-fg/[0.08] shadow-2xl flex flex-col animate-modal-up",
  header: "flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-fg/[0.06] flex-shrink-0",
  body: "flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5",
  footer: "flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 px-4 sm:px-6 py-3 sm:py-4 border-t border-fg/[0.06] flex-shrink-0 safe-b",
};

interface CenteredModalProps {
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  /** "nested" = z-[60], for a dialog opened on top of another dialog */
  layer?: "base" | "nested";
  footer?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
  "data-testid"?: string;
}

export const CenteredModal = ({
  onClose,
  title,
  subtitle,
  icon,
  size = "md",
  layer = "base",
  footer,
  bodyClassName = "",
  children,
  "data-testid": testId,
}: CenteredModalProps): JSX.Element => {
  const zCx = layer === "nested" ? "z-[60]" : "z-50";
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className={`fixed inset-0 ${zCx} flex items-end sm:items-center justify-center sm:p-4`}
      style={MODAL_CX.backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid={testId}
    >
      <div className={`${MODAL_CX.card} ${SIZE_CX[size]}`}>
        <div className={MODAL_CX.header}>
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "var(--brand)" }}
              >
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-fg truncate">{title}</h2>
              {subtitle && <p className="text-[10px] text-fg/60 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center text-fg/60 hover:text-fg hover:bg-fg/[0.06] transition-colors tap-target"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className={`${MODAL_CX.body} ${bodyClassName}`}>{children}</div>

        {footer && <div className={MODAL_CX.footer}>{footer}</div>}
      </div>
    </div>
  );
};
