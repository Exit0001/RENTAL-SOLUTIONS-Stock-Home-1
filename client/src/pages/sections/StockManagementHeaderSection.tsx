import { Bell, User, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { supabase } from "@/lib/supabase";
import { notificationsApi, type AppNotification } from "@/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  activeSection?: string;
}

const UserAvatar = ({ avatarUrl, initials, name, className }: { avatarUrl: string | null; initials: string | null; name: string | null; className: string }) =>
  avatarUrl ? (
    <img src={avatarUrl} alt={name ?? ""} className={`rounded-full object-cover ${className}`} />
  ) : (
    <div className={`rounded-full bg-[#FFFF00]/20 flex items-center justify-center font-bold text-[#FFFF00] ${className}`}>
      {initials || "?"}
    </div>
  );

// แสดงเวลาแบบ relative (เมื่อสักครู่ / x นาทีที่แล้ว / x ชั่วโมงที่แล้ว / x วันที่แล้ว)
const formatRelativeTime = (createdAt: string | Date, tn: (key: string, opts?: Record<string, unknown>) => string): string => {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes < 1) return tn("justNow");
  if (minutes < 60) return tn("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tn("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return tn("daysAgo", { count: days });
};

export const StockManagementHeaderSection = ({
  activeSection = "Home",
}: HeaderProps): JSX.Element => {
  const { t } = useTranslation("nav");
  const { t: tc } = useTranslation("common");
  const { t: ts } = useTranslation("settings");
  const { t: tn } = useTranslation("notifications");
  const { userName, userInitials, userRole, companyName, avatarUrl, token, setActivePage, setSettingsTab, clearAuth } = useAppStore();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.getAll,
    enabled: !!token,
    refetchInterval: 10000,
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: notificationsApi.getUnreadCount,
    enabled: !!token,
    refetchInterval: 10000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidateNotifications,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidateNotifications,
  });

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.isRead) markReadMutation.mutate(n.id);
    if (n.link) setActivePage(n.link);
  };

  const handleViewProfile = () => {
    setSettingsTab("profile");
    setActivePage("Settings");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearAuth();
  };

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
          {t(`pageTitles.${activeSection}`, { defaultValue: activeSection })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="relative p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer focus:outline-none"
              data-testid="button-notifications"
              aria-label={tn("title")}
            >
              <Bell className="w-4.5 h-4.5 text-white/60" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FFFF00] rounded-full" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 bg-[#0f0f0f] border border-white/[0.08] text-white">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.08]">
              <span className="text-sm font-semibold text-white">{tn("title")}</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-xs font-semibold text-[#FFFF00] hover:opacity-80 cursor-pointer"
                  data-testid="button-mark-all-read"
                >
                  {tn("markAllRead")}
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-white/40">{tn("empty")}</div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/[0.04] last:border-b-0 cursor-pointer"
                    data-testid={`notification-${n.id}`}
                  >
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.isRead ? "bg-transparent" : "bg-[#FFFF00]"}`} />
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <span className="text-sm font-medium text-white">{tn(`title.${n.type}`)}</span>
                      <span className="text-xs text-white/60">{tn(`body.${n.type}`, n.meta ?? {})}</span>
                      <span className="text-xs text-white/30">{formatRelativeTime(n.createdAt, tn)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2.5 pl-2 pr-1.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer focus:outline-none"
              data-testid="button-user-menu"
            >
              <span
                className="font-medium text-white/50 text-sm"
                data-testid="text-user-name"
              >
                {userName || "—"}
              </span>
              <UserAvatar avatarUrl={avatarUrl} initials={userInitials} name={userName} className="w-8 h-8 text-xs" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-[#0f0f0f] border border-white/[0.08] text-white">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-3">
                <UserAvatar avatarUrl={avatarUrl} initials={userInitials} name={userName} className="w-9 h-9 text-sm flex-shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold text-white truncate">{userName}</span>
                  <span className="text-xs text-white/50 truncate">
                    {userRole ? ts(`roles.${userRole}`) : ""}{companyName ? ` · ${companyName}` : ""}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/[0.08]" />
            <DropdownMenuItem
              onClick={handleViewProfile}
              className="gap-2 text-white/80 cursor-pointer focus:bg-white/5 focus:text-white"
              data-testid="menu-view-profile"
            >
              <User className="w-4 h-4" /> {t("userMenu.viewProfile")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleLogout}
              className="gap-2 text-white/80 cursor-pointer focus:bg-red-500/10 focus:text-red-400"
              data-testid="menu-logout"
            >
              <LogOut className="w-4 h-4" /> {tc("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
