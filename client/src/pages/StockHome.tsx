import { useState } from "react";
import { Home, Boxes, BarChart2, Briefcase, ClockIcon } from "lucide-react";
import { StockFilterControlsSection } from "./sections/StockFilterControlsSection";
import { StockItemsTableSection } from "./sections/StockItemsTableSection";
import { StockManagementHeaderSection } from "./sections/StockManagementHeaderSection";

const sidebarNavItems = [
  { label: "Home",    Icon: Home },
  { label: "Stock",   Icon: Boxes },
  { label: "Finance", Icon: BarChart2 },
  { label: "Jobs",    Icon: Briefcase },
  { label: "History", Icon: ClockIcon },
];

export const StockHome = (): JSX.Element => {
  const [active, setActive] = useState("Stock");

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col">
      <StockManagementHeaderSection />

      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Sidebar: slim strip, expands to show labels on hover */}
        <aside className="group/sidebar relative flex-shrink-0 w-[3px] hover:w-56 overflow-hidden bg-[#0d0d0d] border-r border-white/10 flex flex-col pt-4 pb-6 transition-all duration-300 ease-in-out">

          {/* Yellow accent line at top */}
          <div className="mx-auto mb-6 w-[2px] h-6 bg-yellow-400/40 rounded-full opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300" />

          <nav className="flex flex-col gap-1 px-2">
            {sidebarNavItems.map(({ label, Icon }) => {
              const isActive = active === label;
              return (
                <button
                  key={label}
                  onClick={() => setActive(label)}
                  className={`group/item relative flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left
                    opacity-0 group-hover/sidebar:opacity-100 transition-all duration-200
                    focus:outline-none focus:ring-1 focus:ring-yellow-400/40
                    ${isActive
                      ? "bg-yellow-400/10 text-yellow-400"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                    }`}
                  title={label}
                >
                  {/* Active left bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-yellow-400 rounded-r-full" />
                  )}

                  <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? "text-yellow-400" : ""}`} />

                  <span className="text-sm font-medium whitespace-nowrap overflow-hidden">
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Bottom divider + version hint */}
          <div className="mt-auto px-4 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300">
            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] text-white/20 tracking-widest uppercase">v1.0.0</p>
            </div>
          </div>
        </aside>

        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <StockFilterControlsSection />
          <div className="flex-1 overflow-auto p-4">
            <StockItemsTableSection />
          </div>
        </main>
      </div>
    </div>
  );
};
