import type { ReactNode, MouseEvent } from "react";

// The mobile counterpart to a <table> row. Every <th> on the desktop table
// must have a matching entry in `fields` here — that equivalence is the
// "nothing dropped" audit for Phase 3 (see SKILL.md §5/§9).
export interface DataCardField {
  label: string;
  value: ReactNode;
  /** span both grid columns (e.g. a long description) */
  full?: boolean;
}

interface DataCardProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  /** left accent border class, e.g. "border-l-emerald-400" */
  accent?: string;
  fields?: DataCardField[];
  actions?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
}

export const DataCard = ({
  title,
  subtitle,
  badge,
  accent,
  fields,
  actions,
  onClick,
  children,
  className = "",
  "data-testid": testId,
}: DataCardProps): JSX.Element => {
  const clickable = !!onClick;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (clickable && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`bg-surface-1 border border-fg/10 ${accent ? `border-l-[3px] ${accent}` : ""} rounded-xl p-3.5 flex flex-col gap-2.5 ${
        clickable ? "cursor-pointer hover:border-fg/20 transition-colors tap-target" : ""
      } ${className}`}
      onClick={onClick}
      onKeyDown={clickable ? handleKeyDown : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-fg text-sm truncate">{title}</div>
          {subtitle && <div className="text-xs text-fg/50 truncate mt-0.5">{subtitle}</div>}
        </div>
        {badge && <div className="flex-shrink-0">{badge}</div>}
      </div>

      {fields && fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {fields.map((f, i) => (
            <div key={i} className={f.full ? "col-span-2" : undefined}>
              <div className="text-[10px] uppercase tracking-wide text-fg/40">{f.label}</div>
              <div className="text-sm text-fg/85 break-words">{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {children}

      {actions && (
        <div
          className="flex items-center gap-2 pt-1.5 border-t border-fg/[0.06] mt-0.5"
          onClick={(e: MouseEvent) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
    </div>
  );
};
