import { StockFilterControlsSection } from "./sections/StockFilterControlsSection";
import { StockItemsTableSection } from "./sections/StockItemsTableSection";
import { StockManagementHeaderSection } from "./sections/StockManagementHeaderSection";

// Navigation sidebar icon items data
const sidebarNavItems = [
  {
    alt: "Home",
    src: "/figmaAssets/home.png",
    className: "w-[53px] h-[53px]",
  },
  {
    alt: "Stock",
    src: "/figmaAssets/stock.png",
    className: "w-[35px] h-[35px]",
  },
  {
    alt: "Finace",
    src: "/figmaAssets/finace.png",
    className: "w-[55px] h-[55px]",
  },
  {
    alt: "Job",
    src: "/figmaAssets/job.png",
    className: "w-10 h-10",
  },
  {
    alt: "History",
    src: "/figmaAssets/history.png",
    className: "w-10 h-10",
  },
];

export const StockHome = (): JSX.Element => {
  return (
    <div className="relative w-[1920px] h-[1080px] bg-black rounded-[40px] overflow-hidden flex flex-col">
      {/* Top header section - full width */}
      <StockManagementHeaderSection />

      {/* Body: sidebar + main content */}
      <div className="flex flex-row flex-1 overflow-hidden">
        {/* Left sidebar navigation */}
        <aside className="relative flex-shrink-0 w-[92px] h-full shadow-[0px_4px_4px_#00000040]">
          {/* Sidebar background */}
          <div className="absolute inset-0 w-[94px] bg-[#0f0f0f] border border-solid border-[#6a6a6a]" />

          {/* Sidebar icons stacked vertically */}
          <nav className="relative flex flex-col items-center pt-[35px] gap-[30px] z-10">
            {sidebarNavItems.map((item) => (
              <button
                key={item.alt}
                className="flex items-center justify-center focus:outline-none"
                aria-label={item.alt}
              >
                <img
                  className={`${item.className} object-cover`}
                  alt={item.alt}
                  src={item.src}
                />
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content area */}
        <main className="flex flex-col flex-1 overflow-hidden">
          {/* Filter controls row */}
          <StockFilterControlsSection />

          {/* Stock items table */}
          <StockItemsTableSection />
        </main>
      </div>
    </div>
  );
};
