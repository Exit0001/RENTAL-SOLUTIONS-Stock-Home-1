import { useState } from "react";
import {
  Clock,
  Search,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Wrench,
  Package,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Heart,
  BarChart3,
} from "lucide-react";

type HistoryFilter = "all" | "stock" | "finance" | "maintenance" | "jobs";

const filters: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "All Activity" },
  { key: "stock", label: "Stock" },
  { key: "finance", label: "Finance" },
  { key: "maintenance", label: "Maintenance" },
  { key: "jobs", label: "Jobs" },
];

const activityLog = [
  { id: 1, type: "stock", action: "Checked Out", detail: "24x J8 Loudspeaker → Festival Sound 2026", person: "James Wilson", time: "Today, 09:15", icon: ArrowRight, color: "text-blue-400" },
  { id: 2, type: "stock", action: "Checked Out", detail: "8x SL-Sub → Festival Sound 2026", person: "Mike Torres", time: "Today, 09:30", icon: ArrowRight, color: "text-blue-400" },
  { id: 3, type: "finance", action: "Invoice Paid", detail: "INV-0042 — Festival Sound Co. — £12,400", person: "System", time: "Today, 08:50", icon: DollarSign, color: "text-emerald-400" },
  { id: 4, type: "maintenance", action: "Repair Started", detail: "J8-004 — driver cone replacement", person: "Mike Torres", time: "Yesterday, 16:20", icon: Wrench, color: "text-amber-400" },
  { id: 5, type: "stock", action: "Returned", detail: "14x items — Wedding Reception", person: "Sarah Chen", time: "Yesterday, 22:30", icon: CheckCircle2, color: "text-emerald-400" },
  { id: 6, type: "jobs", action: "Job Completed", detail: "Wedding Reception — all items returned", person: "Sarah Chen", time: "Yesterday, 22:45", icon: CheckCircle2, color: "text-emerald-400" },
  { id: 7, type: "maintenance", action: "Damage Reported", detail: "J8-004 — dropped during load-in, cone damaged", person: "Mike Torres", time: "Yesterday, 16:15", icon: AlertTriangle, color: "text-red-400" },
  { id: 8, type: "finance", action: "Quote Sent", detail: "QT-2026-031 — City Park Concert — £18,900", person: "Emma Davis", time: "14 Mar, 14:30", icon: DollarSign, color: "text-[#FFFF00]" },
  { id: 9, type: "stock", action: "Checked Out", detail: "18x items → Corporate Gala", person: "Emma Davis", time: "14 Mar, 10:00", icon: ArrowRight, color: "text-blue-400" },
  { id: 10, type: "jobs", action: "Pull Sheet Created", detail: "PS-007 — Tech Conference AV — 32 items", person: "James Wilson", time: "14 Mar, 09:00", icon: Package, color: "text-[#FFFF00]" },
  { id: 11, type: "maintenance", action: "Service Completed", detail: "GSL8-005 — input connector replaced", person: "Mike Torres", time: "12 Mar, 17:00", icon: CheckCircle2, color: "text-emerald-400" },
  { id: 12, type: "finance", action: "Invoice Created", detail: "INV-0044 — Wedding Bliss — £3,200", person: "System", time: "11 Mar, 09:00", icon: DollarSign, color: "text-blue-400" },
  { id: 13, type: "stock", action: "Sub-Rental Received", detail: "4x QSC K12.2 from Partner Audio Ltd", person: "Tom Baker", time: "10 Mar, 14:00", icon: Package, color: "text-purple-400" },
  { id: 14, type: "jobs", action: "Crew Assigned", detail: "4 crew members → City Park Concert", person: "System", time: "10 Mar, 11:00", icon: Users, color: "text-blue-400" },
  { id: 15, type: "maintenance", action: "Inspection Complete", detail: "SM58-008 — annual safety check passed", person: "Sarah Chen", time: "10 Mar, 10:30", icon: CheckCircle2, color: "text-emerald-400" },
];

const utilizationData = [
  { category: "Line Array", pct: 82 },
  { category: "Subwoofers", pct: 74 },
  { category: "Microphones", pct: 61 },
  { category: "DI Boxes", pct: 45 },
  { category: "Cables", pct: 38 },
];

const healthMetrics = [
  { label: "Overall Health", value: "87%", color: "text-emerald-400" },
  { label: "Assets At Risk", value: "6", color: "text-amber-400" },
  { label: "Avg Age (months)", value: "18.4", color: "text-white/60" },
];

const revenueMonths = [
  { month: "Oct", revenue: 62400, profit: 38200 },
  { month: "Nov", revenue: 71500, profit: 44300 },
  { month: "Dec", revenue: 58200, profit: 34100 },
  { month: "Jan", revenue: 49800, profit: 28900 },
  { month: "Feb", revenue: 67300, profit: 41200 },
  { month: "Mar", revenue: 84520, profit: 52800 },
];

export const HistoryPage = (): JSX.Element => {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = activityLog.filter((a) => {
    if (filter !== "all" && a.type !== filter) return false;
    if (search && !a.detail.toLowerCase().includes(search.toLowerCase()) && !a.person.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const maxRevenue = Math.max(...revenueMonths.map((m) => m.revenue));

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4" data-testid="page-history">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white" data-testid="text-history-title">History & Analytics</h1>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border-b border-white/[0.06]">
              {filters.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${filter === f.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/30 hover:text-white/50"}`} data-testid={`tab-history-${f.key}`}>{f.label}</button>
              ))}
            </div>
            <div className="ml-auto relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity..." className="pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white/70 placeholder:text-white/15 w-52 focus:outline-none focus:border-[#FFFF00]/30" data-testid="input-history-search" />
            </div>
          </div>

          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FFFF00]" />
              <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">Activity Log</span>
              <span className="ml-auto text-[10px] text-white/20">{filtered.length} entries</span>
            </div>
            <div className="divide-y divide-white/[0.04] max-h-[500px] overflow-y-auto">
              {filtered.map((entry) => {
                const typeBadgeStyles: Record<string, string> = {
                  stock: "bg-blue-500/10 text-blue-400",
                  finance: "bg-emerald-500/10 text-emerald-400",
                  maintenance: "bg-amber-500/10 text-amber-400",
                  jobs: "bg-purple-500/10 text-purple-400",
                };
                return (
                  <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors" data-testid={`activity-${entry.id}`}>
                    <div className={`mt-0.5 w-6 h-6 rounded flex items-center justify-center bg-white/[0.04] flex-shrink-0`}>
                      <entry.icon className={`w-3.5 h-3.5 ${entry.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${typeBadgeStyles[entry.type]}`}>{entry.type}</span>
                        <span className={`text-xs font-semibold ${entry.color}`}>{entry.action}</span>
                        <span className="text-[10px] text-white/15">{entry.time}</span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">{entry.detail}</p>
                      <span className="text-[10px] text-white/20">{entry.person}</span>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-white/20 text-sm">No activity matching your filters</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-4 space-y-4">
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-[#FFFF00]" />
              <span className="text-xs font-semibold text-[#FFFF00]">Utilization by Category</span>
            </div>
            {utilizationData.map((cat) => (
              <div key={cat.category} className="mb-2 last:mb-0" data-testid={`utilization-${cat.category.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/50">{cat.category}</span>
                  <span className={`font-semibold ${cat.pct >= 70 ? "text-emerald-400" : cat.pct >= 50 ? "text-amber-400" : "text-white/40"}`}>{cat.pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${cat.pct >= 70 ? "bg-emerald-400/60" : cat.pct >= 50 ? "bg-amber-400/60" : "bg-white/20"}`} style={{ width: `${cat.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">Fleet Health</span>
            </div>
            {healthMetrics.map((m) => (
              <div key={m.label} className="flex justify-between text-xs mb-2 last:mb-0">
                <span className="text-white/40">{m.label}</span>
                <span className={`font-semibold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>

          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#FFFF00]" />
              <span className="text-xs font-semibold text-[#FFFF00]">Revenue Trend (6M)</span>
            </div>
            <div className="flex items-end gap-1.5 h-20">
              {revenueMonths.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col items-center gap-px">
                    <div className="w-full bg-[#FFFF00]/30 rounded-t" style={{ height: `${(m.revenue / maxRevenue) * 60}px` }} />
                    <div className="w-full bg-emerald-400/30 rounded-b" style={{ height: `${(m.profit / maxRevenue) * 60}px` }} />
                  </div>
                  <span className="text-[9px] text-white/20">{m.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#FFFF00]/30" />Revenue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400/30" />Profit</span>
            </div>
            <div className="mt-2 text-xs flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">+18.2%</span>
              <span className="text-white/25">vs last month</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
