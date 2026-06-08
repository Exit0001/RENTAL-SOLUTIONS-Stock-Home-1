import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  TrendingUp,
  MapPin,
  Bell,
  DollarSign,
  Wrench,
  Wifi,
  Boxes,
  Briefcase,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { statsApi } from "@/api";

interface HomePageProps {
  onNavigate: (page: string) => void;
}

export const HomePage = ({ onNavigate }: HomePageProps): JSX.Element => {
  const { token, companyName } = useAppStore();

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: statsApi.get,
    enabled: !!token,
    refetchInterval: 30000, // รีเฟรชทุก 30 วินาที
  });

  // KPI cards สร้างจากข้อมูลจริง
  const kpiCards = [
    { title: "Total Assets",    value: stats?.totalAssets    ?? "—", change: "", trend: "up" as const,   icon: Boxes,      sub: "All tracked units" },
    { title: "Active Jobs",     value: stats?.activeJobs     ?? "—", change: "", trend: "up" as const,   icon: Briefcase,  sub: "Currently running" },
    { title: "Revenue (Month)", value: stats?.monthlyRevenue ? `£${Number(stats.monthlyRevenue).toLocaleString()}` : "£0", change: "", trend: "up" as const, icon: DollarSign, sub: "Paid invoices" },
    { title: "In Maintenance",  value: stats?.inMaintenance  ?? "—", change: "", trend: "down" as const, icon: Wrench,     sub: "Items being repaired" },
  ];

  // notifications จาก activity log จริง
  const notifications = (stats?.recentActivity ?? []).map((a: any) => ({
    id: a.id, type: a.type, title: a.action, desc: a.detail,
    time: new Date(a.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
    color: a.type === "finance" ? "text-emerald-400"
         : a.type === "maintenance" ? "text-amber-400"
         : a.type === "jobs" ? "text-purple-400"
         : "text-blue-400",
  }));

  // quickStats จาก stats API
  const quickStats = [
    { label: "Assets Out",         value: String(stats?.totalAssets    ?? "—"), total: "" },
    { label: "Active Jobs",        value: String(stats?.activeJobs     ?? "—"), total: "" },
    { label: "In Maintenance",     value: String(stats?.inMaintenance  ?? "—"), total: "" },
    { label: "Revenue (Month)",    value: stats?.monthlyRevenue ? `£${Number(stats.monthlyRevenue).toLocaleString()}` : "£0", total: "" },
  ];

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5" data-testid="page-home">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white" data-testid="text-home-title">Welcome back, {companyName}</h1>
          <p className="text-sm text-white/30 mt-0.5">Here's what's happening across your operations</p>
        </div>
        <div className="flex items-center gap-4">
          {quickStats.map((s) => (
            <div key={s.label} className="text-center" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <p className="text-lg font-bold text-white">{s.value}{s.total && <span className="text-xs text-white/20 font-normal">/{s.total}</span>}</p>
              <p className="text-[10px] text-white/25 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {kpiCards.map((card) => (
          <div key={card.title} className="bg-[#111] border border-white/[0.06] rounded-xl p-4 hover:border-[#FFFF00]/15 transition-colors" data-testid={`card-kpi-${card.title.toLowerCase().replace(/\s+/g, "-")}`}>
            <div className="flex items-start justify-between mb-2.5">
              <div className="p-1.5 rounded-lg bg-[#FFFF00]/10">
                <card.icon className="w-4 h-4 text-[#FFFF00]" />
              </div>
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${card.trend === "up" ? "text-emerald-400" : "text-red-400"}`}>
                {card.trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {card.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-white mb-0.5">{card.value}</p>
            <p className="text-[11px] text-white/25">{card.title}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-7 bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-[#FFFF00]" />
            <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">Live Notifications</span>
            <span className="ml-auto text-[10px] text-white/20">{notifications.length} new</span>
          </div>
          <div className="divide-y divide-white/[0.04] max-h-[340px] overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-white/20 text-sm">ยังไม่มี activity</div>
            )}
            {notifications.map((n: any) => (
              <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors" data-testid={`notification-${n.id}`}>
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${n.color.replace("text-", "bg-")}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white/80">{n.title}</span>
                    <span className="text-[10px] text-white/15">{n.time}</span>
                  </div>
                  <p className="text-xs text-white/35 mt-0.5">{n.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-5 bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-[#FFFF00]" />
            <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">Multi-Site Monitor</span>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium text-white/80">{companyName}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/30">
                <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{stats?.activeJobs ?? 0} active jobs</span>
                <span className="ml-auto">{stats?.totalAssets ?? 0} assets</span>
              </div>
              <div className="w-full h-1 bg-white/[0.04] rounded-full mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-[#FFFF00]/60" style={{ width: `${stats?.activeJobs ? "75%" : "0%"}` }} />
              </div>
            </div>
            <p className="text-[10px] text-white/15 text-center">Multi-site support — coming soon</p>
          </div>

          <div className="px-3 pb-3 grid grid-cols-2 gap-2">
            {[
              { label: "View Stock", target: "Stock" },
              { label: "View Finance", target: "Finance" },
              { label: "View Jobs", target: "Jobs" },
              { label: "View History", target: "History" },
            ].map((a) => (
              <button key={a.target} onClick={() => onNavigate(a.target)} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-[#FFFF00]/10 border border-white/[0.06] hover:border-[#FFFF00]/20 transition-all text-xs text-white/50 hover:text-white" data-testid={`button-goto-${a.target.toLowerCase()}`}>
                {a.label}<ChevronRight className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#FFFF00]" />
            <span className="text-xs font-semibold text-[#FFFF00]">Monthly Summary</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-white/40">Active jobs</span><span className="text-white/70 font-medium">{stats?.activeJobs ?? "—"}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/40">Total assets</span><span className="text-white/70 font-medium">{stats?.totalAssets ?? "—"}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/40">In maintenance</span><span className="text-amber-400 font-medium">{stats?.inMaintenance ?? "—"}</span></div>
          </div>
        </div>
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400">Maintenance</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-white/40">In progress</span><span className="text-amber-400 font-medium">{stats?.inMaintenance ?? "—"}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/40">Total assets tracked</span><span className="text-white/70 font-medium">{stats?.totalAssets ?? "—"}</span></div>
          </div>
        </div>
        <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Financial Overview</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-white/40">Revenue (paid invoices)</span><span className="text-emerald-400 font-medium">{stats?.monthlyRevenue ? `£${Number(stats.monthlyRevenue).toLocaleString()}` : "£0"}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/40">Active jobs</span><span className="text-white/70 font-medium">{stats?.activeJobs ?? "—"}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
