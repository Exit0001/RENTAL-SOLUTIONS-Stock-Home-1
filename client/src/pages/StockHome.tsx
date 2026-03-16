import { useState } from "react";
import {
  Home,
  Boxes,
  Briefcase,
  DollarSign,
  Clock,
} from "lucide-react";
import { StockManagementHeaderSection } from "./sections/StockManagementHeaderSection";
import { HomePage } from "./sections/HomePage";
import { StockPage } from "./sections/StockPage";
import { FinancePage } from "./sections/FinancePage";
import { JobsPage } from "./sections/JobsPage";
import { HistoryPage } from "./sections/HistoryPage";

const sidebarNavItems = [
  { label: "Home",    Icon: Home },
  { label: "Stock",   Icon: Boxes },
  { label: "Finance", Icon: DollarSign },
  { label: "Jobs",    Icon: Briefcase },
  { label: "History", Icon: Clock },
];

export const StockHome = (): JSX.Element => {
  const [active, setActive] = useState("Home");

  const renderPage = () => {
    switch (active) {
      case "Home":
        return <HomePage onNavigate={setActive} />;
      case "Stock":
        return <StockPage />;
      case "Finance":
        return <FinancePage />;
      case "Jobs":
        return <JobsPage />;
      case "History":
        return <HistoryPage />;
      default:
        return <HomePage onNavigate={setActive} />;
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col">
      <StockManagementHeaderSection activeSection={active} />

      <div className="flex flex-row flex-1 overflow-hidden">
        <aside className="group/sidebar relative flex-shrink-0 w-[3px] hover:w-48 overflow-hidden bg-[#0d0d0d] border-r border-white/[0.06] flex flex-col pt-2 pb-4 transition-all duration-300 ease-in-out z-10">
          <nav className="flex flex-col gap-0.5 px-1.5">
            {sidebarNavItems.map(({ label, Icon }) => {
              const isActive = active === label;
              return (
                <button
                  key={label}
                  onClick={() => setActive(label)}
                  className={`group/item relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg w-full text-left
                    opacity-0 group-hover/sidebar:opacity-100 transition-all duration-200
                    focus:outline-none focus:ring-1 focus:ring-[#FFFF00]/40
                    ${isActive
                      ? "bg-[#FFFF00]/10 text-[#FFFF00]"
                      : "text-white/30 hover:text-white/70 hover:bg-white/[0.04]"
                    }`}
                  title={label}
                  data-testid={`nav-${label.toLowerCase()}`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-[#FFFF00] rounded-r-full" />
                  )}
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-[#FFFF00]" : ""}`} />
                  <span className="text-[13px] font-medium whitespace-nowrap overflow-hidden">
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-auto px-3 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300">
            <div className="border-t border-white/[0.04] pt-3">
              <p className="text-[9px] text-white/15 tracking-widest uppercase">STAK v2.0</p>
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
