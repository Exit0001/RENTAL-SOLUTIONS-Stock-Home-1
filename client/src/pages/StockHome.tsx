import { StockFilterControlsSection } from "./sections/StockFilterControlsSection";
import { StockItemsTableSection } from "./sections/StockItemsTableSection";
import { StockManagementHeaderSection } from "./sections/StockManagementHeaderSection";

const sidebarNavItems = [
  { alt: "Home", src: "/figmaAssets/home.png" },
  { alt: "Stock", src: "/figmaAssets/stock.png" },
  { alt: "Finance", src: "/figmaAssets/finace.png" },
  { alt: "Job", src: "/figmaAssets/job.png" },
  { alt: "History", src: "/figmaAssets/history.png" },
];

export const StockHome = (): JSX.Element => {
  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] flex flex-col">
      <StockManagementHeaderSection />

      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Sidebar: collapsed by default, expands on hover */}
        <aside className="group/sidebar flex-shrink-0 w-0 hover:w-20 overflow-hidden bg-[#0f0f0f] border-r border-white/10 flex flex-col items-center py-6 gap-5 transition-all duration-300 ease-in-out">
          {sidebarNavItems.map((item) => (
            <button
              key={item.alt}
              className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 opacity-0 group-hover/sidebar:opacity-100 transition-all duration-200"
              aria-label={item.alt}
              title={item.alt}
            >
              <img
                className="w-7 h-7 object-contain"
                alt={item.alt}
                src={item.src}
              />
            </button>
          ))}
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
