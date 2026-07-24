import React from "react";
import { X, Loader2 } from "lucide-react";

// ── Template โครงหน้าต่างมาตรฐาน (ใช้ร่วมกันทุก workspace เต็มจอ) ──
// หัว: [ไอคอน + ชื่อ] ซ้าย · [แท็บ] กลาง · [actions + X] ขวา
// ตัว: [แถบซ้าย?] + [เนื้อหาหลัก] + [แผงขวา?]  (แต่ละส่วน scroll เอง)
// ท้าย: [ข้อมูล/สรุป] ซ้าย · [ปุ่ม] ขวา
// ปุ่มหลัก = สีเหลือง (WSButton variant="primary") อยู่ขวาล่างเสมอ

export interface WSTab {
  key: string;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  /** แสดงแทน count ได้ (เช่น เศษ "0/5" หรือไอคอนเสร็จ) */
  badge?: React.ReactNode;
}

interface WorkspaceShellProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  tabs?: WSTab[];
  activeTab?: string;
  onTabChange?: (key: string) => void;
  headerActions?: React.ReactNode;
  onClose: () => void;
  sidebar?: React.ReactNode;
  sidebarTitle?: string;
  rightPanel?: React.ReactNode;
  rightPanelTitle?: React.ReactNode;
  /** ท้าย: ควรใส่ 2 ก้อน — [ข้อมูล/สรุป] และ [ปุ่ม] (จัดชิดซ้าย/ขวาอัตโนมัติ) */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const WorkspaceShell = ({
  icon, title, subtitle, tabs, activeTab, onTabChange, headerActions,
  onClose, sidebar, sidebarTitle, rightPanel, rightPanelTitle, footer, children,
}: WorkspaceShellProps): JSX.Element => (
  <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col animate-fade-in">
    {/* หัว */}
    <header className="flex items-center gap-3 px-6 py-3 border-b border-white/[0.06] flex-shrink-0">
      {icon && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFFF00" }}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h1 className="text-lg font-bold text-white truncate leading-tight">{title}</h1>
        {subtitle && <p className="text-[10px] text-white/50 truncate">{subtitle}</p>}
      </div>
      {tabs && tabs.length > 0 && (
        <nav className="flex items-center gap-1 ml-4">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => onTabChange?.(tb.key)}
              className={`flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-bold transition-colors ${activeTab === tb.key ? "bg-[#FFFF00] text-black" : "text-white/60 hover:text-white hover:bg-white/5"}`}
            >
              {tb.Icon && <tb.Icon className="w-3.5 h-3.5" />}
              {tb.label}
              {tb.badge != null
                ? tb.badge
                : typeof tb.count === "number" && (
                    <span className={`text-[10px] ${activeTab === tb.key ? "text-black/60" : "text-white/40"}`}>{tb.count}</span>
                  )}
            </button>
          ))}
        </nav>
      )}
      <div className="ml-auto flex items-center gap-2">
        {headerActions}
        <button onClick={onClose} className="w-9 h-9 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
    </header>

    {/* ตัว */}
    <div className="flex-1 flex min-h-0">
      {sidebar && (
        <aside className="w-[300px] lg:w-[340px] flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-[#0b0b0b]">
          {sidebarTitle && (
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0">
              <span className="text-xs font-bold text-white/50">{sidebarTitle}</span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">{sidebar}</div>
        </aside>
      )}
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
      {rightPanel && (
        <aside className="w-[300px] lg:w-[360px] flex-shrink-0 flex flex-col border-l border-white/[0.06] bg-[#0b0b0b]">
          {rightPanelTitle && (
            <div className="px-4 py-2.5 border-b border-white/[0.06] flex-shrink-0">
              <span className="text-xs font-bold text-white/50">{rightPanelTitle}</span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">{rightPanel}</div>
        </aside>
      )}
    </div>

    {/* ท้าย */}
    {footer && (
      <footer className="flex items-center justify-between gap-4 px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
        {footer}
      </footer>
    )}
  </div>
);

// ปุ่มมาตรฐาน — ให้ทุกหน้าใช้สไตล์เดียวกัน
export const WSButton = ({
  variant = "ghost", icon, pending, className = "", children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  icon?: React.ReactNode;
  pending?: boolean;
}): JSX.Element => {
  const base = "h-9 px-4 rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none";
  const style =
    variant === "primary" ? "text-black hover:opacity-90"
    : variant === "danger" ? "text-red-400 border border-red-500/30 hover:bg-red-500/10"
    : "text-white/70 border border-white/10 hover:text-white hover:border-white/20";
  return (
    <button
      className={`${base} ${style} ${className}`}
      style={variant === "primary" ? { backgroundColor: "#FFFF00" } : undefined}
      {...rest}
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
};
