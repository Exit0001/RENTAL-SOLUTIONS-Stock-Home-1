import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { useAppStore } from "@/store/appStore";
import { navItemsForRole } from "@/lib/navItems";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { supabase } from "@/lib/supabase";

// The mobile hamburger drawer. Built on the already-installed shadcn Sheet
// (Radix Dialog, @radix-ui/react-dialog is a real dependency) — zero new
// packages, and gets focus trap / Escape / body scroll lock / portal for
// free. See .claude/skills/stak-mobile-responsive/SKILL.md §4.
//
// Two mandatory overrides on SheetContent below: z-[70] (Sheet hardcodes
// z-50) and bg-surface-1 (Sheet's `bg-background` resolves to white — this
// app themes via `data-theme`, not the `.dark` class, so `.dark` is never
// applied).
interface AppNavDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AppNavDrawer = ({ open, onOpenChange }: AppNavDrawerProps): JSX.Element => {
  const { t } = useTranslation("nav");
  const { t: tc } = useTranslation("common");
  const { activePage, setActivePage, userRole, companyName, companyLogoUrl, clearAuth } = useAppStore();
  const { isMobile } = useBreakpoint();

  // R6: never let an open Sheet unmount while Radix's body scroll-lock is
  // active, or the whole app is left permanently unscrollable. Always close
  // it first if the viewport grows past mobile.
  useEffect(() => {
    if (!isMobile && open) onOpenChange(false);
  }, [isMobile, open, onOpenChange]);

  const handleNavigate = (key: string) => {
    setActivePage(key);
    onOpenChange(false);
  };

  const handleLogout = async () => {
    onOpenChange(false);
    await supabase.auth.signOut();
    clearAuth();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="z-[70] w-[280px] p-0 bg-surface-1 text-fg border-r border-fg/[0.06] gap-0 flex flex-col"
        overlayClassName="z-[70]"
      >
        <div className="flex items-center gap-3 px-4 py-4 border-b border-fg/[0.06] flex-shrink-0">
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt={companyName ?? "logo"} className="h-7 max-w-[160px] object-contain" />
          ) : (
            <div className="font-black text-brand text-lg tracking-[0.2em]">STAK</div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-1">
          {navItemsForRole(userRole).map(({ key, labelKey, Icon }) => {
            const isActive = activePage === key;
            return (
              <button
                key={key}
                onClick={() => handleNavigate(key)}
                className={`flex items-center gap-3 min-h-[48px] px-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-brand/10 text-brand" : "text-fg/70 hover:text-fg hover:bg-fg/[0.04]"
                }`}
                data-testid={`drawer-nav-${key.toLowerCase()}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                {t(labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-fg/[0.06] p-2 flex flex-col gap-1 flex-shrink-0 safe-b">
          <LanguageSwitcher variant="sidebar" />
          <ThemeSwitcher variant="sidebar" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 min-h-[48px] px-3 rounded-lg text-sm font-medium text-fg/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            data-testid="drawer-logout"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            {tc("logout")}
          </button>
          <p className="text-[8px] text-fg/40 tracking-widest uppercase text-center pt-2">v2.0</p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
