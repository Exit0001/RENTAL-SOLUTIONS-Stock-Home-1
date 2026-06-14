import { Home, Boxes, Briefcase, DollarSign, Clock, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StockManagementHeaderSection } from "./sections/StockManagementHeaderSection";
import { HomePage } from "./sections/HomePage";
import { StockPage } from "./sections/StockPage";
import { FinancePage } from "./sections/FinancePage";
import { JobsPage } from "./sections/JobsPage";
import { HistoryPage } from "./sections/HistoryPage";
import { SettingsPage } from "./sections/SettingsPage";
import { useAppStore } from "@/store/appStore";
import { useIsFetching } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const GlobalLoadingBar = () => {
  const n = useIsFetching();
  if (!n) return null;
  return (
    <div className="fixed top-0 left-0 right-0 h-[2px] z-[9999] overflow-hidden bg-[#FFFF00]/10">
      <div className="animate-loading-bar" />
    </div>
  );
};

export const StockHome = (): JSX.Element => {
  const { activePage, setActivePage, userRole } = useAppStore();
  const { t } = useTranslation("nav");

  // กำหนด nav items ตาม role
  // crew เห็นแค่ Home + Jobs
  // manager/admin เห็นทุกหน้า
  const navItems = [
    { key: "Home",     labelKey: "home",     Icon: Home,       roles: ["admin", "manager", "crew"] },
    { key: "Stock",    labelKey: "stock",    Icon: Boxes,      roles: ["admin", "manager"] },
    { key: "Finance",  labelKey: "finance",  Icon: DollarSign, roles: ["admin", "manager"] },
    { key: "Jobs",     labelKey: "jobs",     Icon: Briefcase,  roles: ["admin", "manager", "crew"] },
    { key: "History",  labelKey: "history",  Icon: Clock,      roles: ["admin", "manager"] },
    { key: "Settings", labelKey: "settings", Icon: Settings,   roles: ["admin", "manager", "crew"] },
  ].filter((item) => !userRole || item.roles.includes(userRole));

  const renderPage = () => {
    switch (activePage) {
      case "Home":     return <HomePage onNavigate={setActivePage} />;
      case "Stock":    return <StockPage />;
      case "Finance":  return <FinancePage />;
      case "Jobs":     return <JobsPage />;
      case "History":  return <HistoryPage />;
      case "Settings": return <SettingsPage />;
      default:         return <HomePage onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col">
      <GlobalLoadingBar />
      <StockManagementHeaderSection activeSection={activePage} />

      <div className="flex flex-row flex-1 overflow-hidden">
        <aside className="flex-shrink-0 w-16 bg-[#0d0d0d] border-r border-white/[0.06] flex flex-col items-center pt-3 pb-4 z-10">
          <nav className="flex flex-col gap-1 w-full px-2">
            {navItems.map(({ key, labelKey, Icon }) => {
              const isActive = activePage === key;
              const label = t(labelKey);
              return (
                <button key={key} onClick={() => setActivePage(key)}
                  className={`group relative flex flex-col items-center gap-1 py-2.5 rounded-lg w-full transition-colors duration-200
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFF00]/50
                    ${isActive ? "bg-[#FFFF00]/10 text-[#FFFF00]" : "text-white/60 hover:text-white hover:bg-white/[0.04]"}`}
                  title={label} data-testid={`nav-${key.toLowerCase()}`}>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-[#FFFF00] rounded-r-full" />}
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-[10px] font-medium leading-none">{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto w-full px-2">
            <div className="border-t border-white/[0.06] pt-2 flex flex-col gap-1">
              <LanguageSwitcher variant="sidebar" />
              <div className="border-t border-white/[0.06] pt-2 flex justify-center">
                <p className="text-[8px] text-white/40 tracking-widest uppercase">v2.0</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {renderPage()}
        </div>
      </div>
    </div>
  );
};
