import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StockManagementHeaderSection } from "./sections/StockManagementHeaderSection";
import { HomePage } from "./sections/HomePage";
import { StockPage } from "./sections/StockPage";
import { FinancePage } from "./sections/FinancePage";
import { JobsPage } from "./sections/JobsPage";
import { CrewPage } from "./sections/CrewPage";
import { HistoryPage } from "./sections/HistoryPage";
import { SettingsPage } from "./sections/SettingsPage";
import { useAppStore } from "@/store/appStore";
import { useIsFetching } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AppNavDrawer } from "@/components/AppNavDrawer";
import { navItemsForRole } from "@/lib/navItems";

const GlobalLoadingBar = () => {
  const n = useIsFetching();
  if (!n) return null;
  return (
    <div className="fixed top-0 left-0 right-0 h-[2px] z-[9999] overflow-hidden bg-brand/10">
      <div className="animate-loading-bar" />
    </div>
  );
};

export const StockHome = (): JSX.Element => {
  const { activePage, setActivePage, userRole, theme } = useAppStore();
  const { t } = useTranslation("nav");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // sync ธีมที่เลือกไว้ (persist ใน localStorage) เข้า <html data-theme="..."> ทุกครั้งที่เปลี่ยน/โหลดแอป
  useEffect(() => {
    document.documentElement.dataset.theme = theme === "red" ? "red" : "";
  }, [theme]);

  // กำหนด nav items ตาม role — source เดียวกับ AppNavDrawer (lib/navItems.ts)
  // crew เห็นแค่ Home + Jobs
  // manager/admin เห็นทุกหน้า
  const navItems = navItemsForRole(userRole);

  const renderPage = () => {
    switch (activePage) {
      case "Home":     return <HomePage onNavigate={setActivePage} />;
      case "Stock":    return <StockPage />;
      case "Finance":  return <FinancePage />;
      case "Jobs":     return <JobsPage />;
      case "Crew":     return <CrewPage />;
      case "History":  return <HistoryPage />;
      case "Settings": return <SettingsPage />;
      default:         return <HomePage onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="h-[100dvh] w-full bg-surface-0 flex flex-col overflow-hidden">
      <GlobalLoadingBar />
      <StockManagementHeaderSection activeSection={activePage} onOpenMenu={() => setDrawerOpen(true)} />
      <AppNavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Nav rail — tablet (>=768) and desktop only. Phones use the hamburger drawer instead. */}
        <aside className="hidden md:flex flex-shrink-0 w-16 bg-surface-1 border-r border-fg/[0.06] flex-col items-center pt-3 pb-4 z-10">
          <nav className="flex flex-col gap-1 w-full px-2">
            {navItems.map(({ key, labelKey, Icon }) => {
              const isActive = activePage === key;
              const label = t(labelKey);
              return (
                <button key={key} onClick={() => setActivePage(key)}
                  className={`group relative flex flex-col items-center gap-1 py-2.5 rounded-lg w-full transition-colors duration-200
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50
                    ${isActive ? "bg-brand/10 text-brand" : "text-fg/60 hover:text-fg hover:bg-fg/[0.04]"}`}
                  title={label} data-testid={`nav-${key.toLowerCase()}`}>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-brand rounded-r-full" />}
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto w-full px-2">
            <div className="border-t border-fg/[0.06] pt-2 flex flex-col gap-1">
              <LanguageSwitcher variant="sidebar" />
              <ThemeSwitcher variant="sidebar" />
              <div className="border-t border-fg/[0.06] pt-2 flex justify-center">
                <p className="text-[8px] text-fg/40 tracking-widest uppercase">v2.0</p>
              </div>
            </div>
          </div>
        </aside>

        {/* No page-level horizontal scroll, ever — every wide thing owns its own local
            .h-scroll. See .claude/skills/stak-mobile-responsive/SKILL.md §4. */}
        <div className="flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          {renderPage()}
        </div>
      </div>
    </div>
  );
};
