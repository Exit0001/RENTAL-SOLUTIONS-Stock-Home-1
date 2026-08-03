import React from "react";
import { X, Loader2, ChevronLeft } from "lucide-react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { ScrollTabs } from "./ScrollTabs";

// ── Template โครงหน้าต่างมาตรฐาน (ใช้ร่วมกันทุก workspace เต็มจอ) ──
// หัว: [ไอคอน + ชื่อ] ซ้าย · [แท็บ] กลาง (เดสก์ท็อป) · [actions + X] ขวา
// มือถือ (<768): แท็บ + sidebar (ถ้ามี) รวมเป็นแถบ ScrollTabs แถวเดียวใต้หัว
//   แล้วแสดงทีละแผง — ดู .claude/skills/stak-mobile-responsive/SKILL.md §5/P7
// ตัว: [แถบซ้าย?] + [เนื้อหาหลัก]  (แต่ละส่วน scroll เอง)
// ท้าย: [ข้อมูล/สรุป] ซ้าย · [ปุ่ม] ขวา — มือถือ: ปุ่มหลักเต็มความกว้าง อยู่ล่างสุด
// ปุ่มหลัก = สีเหลือง (WSButton variant="primary") อยู่ขวาล่างเสมอ

export interface WSTab {
  key: string;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  /** แสดงแทน count ได้ (เช่น เศษ "0/5" หรือไอคอนเสร็จ) */
  badge?: React.ReactNode;
}

/** แผงเพิ่มเติมที่ปรากฏเป็นแท็บเฉพาะบนมือถือ (เช่น sidebar ของ shell, ตะกร้าที่ปกติอยู่คู่กับ catalog) */
export interface WSMobilePane {
  key: string;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  content: React.ReactNode;
  /** ซ่อนด้วย hidden แทนการ unmount เมื่อไม่ active — ค่าเริ่มต้น true (ดู PaneTabs) */
  keepMounted?: boolean;
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
  /** แผงเสริมที่รวมเข้ากับ tabs เป็นแถบเดียวบนมือถือเท่านั้น (ดู WSMobilePane) */
  mobilePanes?: WSMobilePane[];
  /** ท้าย: ควรใส่ 2 ก้อน — [ข้อมูล/สรุป] และ [ปุ่ม] (จัดชิดซ้าย/ขวาอัตโนมัติ) */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const MOBILE_SIDEBAR_KEY = "__sidebar";

export const WorkspaceShell = ({
  icon, title, subtitle, tabs, activeTab, onTabChange, headerActions,
  onClose, sidebar, sidebarTitle, mobilePanes, footer, children,
}: WorkspaceShellProps): JSX.Element => {
  const { isMobile } = useBreakpoint();

  // บนมือถือ: sidebar (ถ้ามี) กลายเป็นแท็บแรก ตามด้วย tabs เดิม แล้วตามด้วย mobilePanes ที่ส่งมา
  const mobileStrip = isMobile
    ? [
        ...(sidebar ? [{ key: MOBILE_SIDEBAR_KEY, label: sidebarTitle || title, content: sidebar }] : []),
        ...(tabs && tabs.length > 0
          ? tabs.map((tb) => ({ key: tb.key, label: tb.label, Icon: tb.Icon, badge: tb.badge, count: tb.count, content: null as React.ReactNode }))
          : []),
        ...(mobilePanes ?? []),
      ]
    : [];

  const hasMobileStrip = isMobile && mobileStrip.length > 0;

  // แท็บที่ active บนมือถือ: จำการแตะล่าสุดไว้เอง (manualMobileKey) เพราะ __sidebar ไม่มีอยู่ใน
  // domain ของ activeTab ที่ parent ควบคุม — ถ้าอิง activeTab เป็นหลักอย่างเดียว การแตะกลับไปที่
  // แท็บ sidebar จะไม่มีทางเกิดขึ้นได้เลยหลังจากออกจากมันไปแท็บอื่นแล้ว (แก้บั๊ก 2026-08-03)
  const [manualMobileKey, setManualMobileKey] = React.useState<string | null>(null);
  React.useEffect(() => { setManualMobileKey(null); }, [activeTab]);

  const mobileActive =
    (manualMobileKey && mobileStrip.some((p) => p.key === manualMobileKey) && manualMobileKey) ||
    (activeTab && mobileStrip.some((p) => p.key === activeTab) && activeTab) ||
    (sidebar ? MOBILE_SIDEBAR_KEY : mobileStrip[0]?.key);

  const handleMobileTabChange = (key: string) => {
    setManualMobileKey(key);
    if (key === MOBILE_SIDEBAR_KEY) return; // sidebar pane มีปุ่มของตัวเอง ไม่ผ่าน onTabChange
    onTabChange?.(key);
  };

  return (
    <div className="fixed inset-0 z-50 bg-surface-0 flex flex-col animate-fade-in h-[100dvh]">
      {/* หัว — มือถือเป็น app bar (ย้อนกลับซ้าย), เดสก์ท็อปเป็นแถบเดิม (ไอคอน+ชื่อ+แท็บ+X) */}
      <header className="flex items-center gap-2 md:gap-3 px-2 md:px-6 py-1.5 md:py-3 border-b border-fg/[0.06] flex-shrink-0">
        {/* ปุ่มย้อนกลับ — เฉพาะมือถือ ตำแหน่งซ้ายตามที่ผู้ใช้มือถือคาดหวัง */}
        <button
          onClick={onClose}
          aria-label="ย้อนกลับ"
          className="md:hidden w-11 h-11 -ml-1 rounded-xl flex items-center justify-center text-fg/80 hover:bg-fg/[0.08] active:bg-fg/[0.12] transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-6 h-6" aria-hidden="true" />
        </button>
        {icon && (
          <div className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand)" }}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1 md:flex-none">
          <h1 className="text-[15px] md:text-lg font-bold text-fg truncate leading-tight">{title}</h1>
          {subtitle && <p className="text-[11px] md:text-[10px] text-fg/50 truncate leading-tight">{subtitle}</p>}
        </div>
        {/* แท็บเดสก์ท็อป/แท็บเล็ต — มือถือย้ายไปแถวใต้หัวแทน */}
        {tabs && tabs.length > 0 && (
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => onTabChange?.(tb.key)}
                className={`flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-bold transition-colors ${activeTab === tb.key ? "bg-brand text-black" : "text-fg/60 hover:text-fg hover:bg-fg/5"}`}
              >
                {tb.Icon && <tb.Icon className="w-3.5 h-3.5" aria-hidden="true" />}
                {tb.label}
                {tb.badge != null
                  ? tb.badge
                  : typeof tb.count === "number" && (
                      <span className={`text-[10px] ${activeTab === tb.key ? "text-black/60" : "text-fg/40"}`}>{tb.count}</span>
                    )}
              </button>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-1 md:gap-2 flex-shrink-0">
          {headerActions}
          {/* X เฉพาะเดสก์ท็อป — มือถือใช้ปุ่มย้อนกลับซ้ายแทน ไม่ให้มีปุ่มปิด 2 ที่ */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="hidden md:flex w-9 h-9 rounded-lg items-center justify-center text-fg/60 hover:text-fg hover:bg-fg/[0.06] transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* แถบแท็บมือถือ: sidebar + tabs + mobilePanes รวมเป็นแถบเดียว */}
      {hasMobileStrip && (
        <ScrollTabs
          tabs={mobileStrip.map((p) => ({ key: p.key, label: p.label, Icon: p.Icon, badge: p.badge, count: (p as WSTab).count }))}
          active={mobileActive!}
          onChange={handleMobileTabChange}
          variant="pill"
          className="px-3 py-2 border-b border-fg/[0.06] flex-shrink-0 bg-surface-1"
        />
      )}

      {/* ตัว */}
      <div className="flex-1 flex min-h-0">
        {isMobile ? (
          <>
            {/* sidebar pane — แสดงเมื่อ active */}
            {sidebar && (
              <div className={`flex-1 min-h-0 flex flex-col ${mobileActive === MOBILE_SIDEBAR_KEY ? "" : "hidden"}`}>
                <div className="flex-1 overflow-y-auto">{sidebar}</div>
              </div>
            )}
            {/* children (เนื้อหาหลักของแท็บที่เลือกจาก tabs เดิม) — แสดงเมื่อ active ตรงกับแท็บใดแท็บหนึ่งใน tabs หรือไม่มี sidebar/mobilePanes เลย */}
            <div
              className={`flex-1 min-h-0 flex flex-col ${
                (tabs && tabs.some((t) => t.key === mobileActive)) || (!sidebar && !mobilePanes?.length) ? "" : "hidden"
              }`}
            >
              {children}
            </div>
            {/* mobilePanes เพิ่มเติม (เช่นตะกร้า) */}
            {(mobilePanes ?? []).map((p) => {
              const isActive = mobileActive === p.key;
              const keepMounted = p.keepMounted !== false;
              if (!isActive && !keepMounted) return null;
              return (
                <div key={p.key} className={`flex-1 min-h-0 flex flex-col ${isActive ? "" : "hidden"}`}>
                  {p.content}
                </div>
              );
            })}
          </>
        ) : (
          <>
            {sidebar && (
              <aside className="w-full md:w-[280px] lg:w-[340px] flex-shrink-0 flex flex-col border-r border-fg/[0.06] bg-surface-1">
                {sidebarTitle && (
                  <div className="px-4 py-2.5 border-b border-fg/[0.06] flex-shrink-0">
                    <span className="text-xs font-bold text-fg/50">{sidebarTitle}</span>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto">{sidebar}</div>
              </aside>
            )}
            <main className="flex-1 flex flex-col min-w-0">{children}</main>
          </>
        )}
      </div>

      {/* ท้าย — มือถือ: แถบสรุป + ปุ่มหลักเต็มความกว้าง ติดขอบล่างเหนือ gesture bar
          (ใช้ md: ไม่ใช่ sm: เพื่อให้ขอบตรงกับ shell ทั้งตัว — เดิมใช้ sm: ทำให้ช่วง
          640–767px footer เป็นแถวขณะที่ส่วนอื่นยังเป็นโหมดมือถือ) */}
      {footer && (
        <footer className="flex flex-col-reverse md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-4 px-3 md:px-6 py-2.5 md:py-4 border-t border-fg/[0.06] flex-shrink-0 safe-b bg-surface-1 md:bg-transparent">
          {footer}
        </footer>
      )}
    </div>
  );
};

// ปุ่มมาตรฐาน — ให้ทุกหน้าใช้สไตล์เดียวกัน
export const WSButton = ({
  variant = "ghost", icon, pending, className = "", children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  icon?: React.ReactNode;
  pending?: boolean;
}): JSX.Element => {
  // มือถือ: สูง 44px + มุมโค้งกว่า (ปุ่มใน footer จะถูกยืดเต็มความกว้างโดย flex ของ footer เอง)
  const base = "h-11 md:h-9 px-4 rounded-xl md:rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none tap-target";
  const style =
    variant === "primary" ? "text-black hover:opacity-90"
    : variant === "danger" ? "text-red-400 border border-red-500/30 hover:bg-red-500/10"
    : "text-fg/70 border border-fg/10 hover:text-fg hover:border-fg/20";
  return (
    <button
      className={`${base} ${style} ${className}`}
      style={variant === "primary" ? { backgroundColor: "var(--brand)" } : undefined}
      {...rest}
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
};
