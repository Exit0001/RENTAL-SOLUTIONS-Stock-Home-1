import { Bell } from "lucide-react";

interface HeaderProps {
  activeSection?: string;
}

const sectionTitles: Record<string, string> = {
  Home: "Dashboard",
  Stock: "Stock Management",
  Finance: "Finance & Billing",
  Jobs: "Job Management",
  History: "History & Analytics",
};

export const StockManagementHeaderSection = ({
  activeSection = "Home",
}: HeaderProps): JSX.Element => {
  return (
    <header className="w-full h-14 bg-[#0f0f0f] border-b border-white/10 flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div
          className="font-black text-[#FFFF00] text-xl tracking-[0.2em]"
          data-testid="text-logo"
        >
          STAK
        </div>
        <div className="w-px h-6 bg-white/10" />
        <div
          className="font-semibold text-white/60 text-sm tracking-wide uppercase"
          data-testid="text-header-title"
        >
          {sectionTitles[activeSection] || activeSection}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
          data-testid="button-notifications"
        >
          <Bell className="w-4.5 h-4.5 text-white/40" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FFFF00] rounded-full" />
        </button>
        <div className="flex items-center gap-2.5">
          <span
            className="font-medium text-white/50 text-sm"
            data-testid="text-user-name"
          >
            Yossapon
          </span>
          <div
            className="w-8 h-8 rounded-full bg-[#FFFF00]/20 flex items-center justify-center text-xs font-bold text-[#FFFF00]"
            data-testid="img-avatar"
          >
            YS
          </div>
        </div>
      </div>
    </header>
  );
};
