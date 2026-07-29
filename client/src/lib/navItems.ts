import { Home, Boxes, Briefcase, DollarSign, Clock, Settings, Users, type LucideIcon } from "lucide-react";

// Single source of truth for the app's top-level nav — consumed by both the
// desktop rail (StockHome.tsx) and the mobile hamburger drawer (AppNavDrawer.tsx)
// so the role filter can never drift between the two.
export type UserRole = "admin" | "manager" | "crew";

export interface NavItem {
  key: string;
  labelKey: string;
  Icon: LucideIcon;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { key: "Home",     labelKey: "home",     Icon: Home,       roles: ["admin", "manager", "crew"] },
  { key: "Stock",    labelKey: "stock",    Icon: Boxes,      roles: ["admin", "manager"] },
  { key: "Finance",  labelKey: "finance",  Icon: DollarSign, roles: ["admin", "manager"] },
  { key: "Jobs",     labelKey: "jobs",     Icon: Briefcase,  roles: ["admin", "manager", "crew"] },
  { key: "Crew",     labelKey: "crew",     Icon: Users,      roles: ["admin", "manager"] },
  { key: "History",  labelKey: "history",  Icon: Clock,      roles: ["admin", "manager"] },
  { key: "Settings", labelKey: "settings", Icon: Settings,   roles: ["admin", "manager", "crew"] },
];

export function navItemsForRole(role: UserRole | null): NavItem[] {
  return NAV_ITEMS.filter((item) => !role || item.roles.includes(role));
}
