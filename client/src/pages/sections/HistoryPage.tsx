import { useState } from "react";
import {
  Clock,
  Search,
  ArrowUpRight,
  TrendingUp,
  Heart,
  BarChart3,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { activityApi, analyticsApi } from "@/api";

type HistoryFilter = "all" | "stock" | "finance" | "maintenance" | "jobs";

const filters: { key: HistoryFilter }[] = [
  { key: "all" },
  { key: "stock" },
  { key: "finance" },
  { key: "maintenance" },
  { key: "jobs" },
];

export const HistoryPage = (): JSX.Element => {
  const { t } = useTranslation("history");
  const { t: tc } = useTranslation("common");
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [search, setSearch] = useState("");
  const { token } = useAppStore();

  const { data: activityLog = [] } = useQuery({
    queryKey: ["activity"],
    queryFn: activityApi.getAll,
    enabled: !!token,
  });

  const { data: analytics } = useQuery({
    queryKey: ["analytics"],
    queryFn: analyticsApi.get,
    enabled: !!token,
  });

  const utilizationData = analytics?.utilizationData ?? [];
  const healthMetrics   = analytics?.healthMetrics;
  const revenueMonths   = analytics?.revenueMonths ?? [];

  const filtered = (activityLog as any[]).filter((a) => {
    if (filter !== "all" && a.type !== filter) return false;
    if (search && !a.detail.toLowerCase().includes(search.toLowerCase()) && !a.person.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const maxRevenue = revenueMonths.length > 0 ? Math.max(...revenueMonths.map((m) => m.revenue)) : 1;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4" data-testid="page-history">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white" data-testid="text-history-title">{t("pageTitle")}</h1>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border-b border-white/[0.06]">
              {filters.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${filter === f.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/60 hover:text-white"}`} data-testid={`tab-history-${f.key}`}>{f.key === "all" ? t("allActivity") : tc(`statusEnum.${f.key}`)}</button>
              ))}
            </div>
            <div className="ml-auto relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white/70 placeholder:text-white/40 w-52 focus:outline-none focus:border-[#FFFF00]/30" data-testid="input-history-search" />
            </div>
          </div>

          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FFFF00]" />
              <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">{t("activityLogLabel")}</span>
              <span className="ml-auto text-[10px] text-white/60">{t("entriesCount", { count: filtered.length })}</span>
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
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${typeBadgeStyles[entry.type]}`}>{tc(`statusEnum.${entry.type}`, { defaultValue: entry.type })}</span>
                        <span className={`text-xs font-semibold ${entry.color}`}>{entry.action}</span>
                        <span className="text-[10px] text-white/40">{entry.time}</span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">{entry.detail}</p>
                      <span className="text-[10px] text-white/60">{entry.person}</span>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-white/60 text-sm">{t("noActivityMatching")}</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-4 space-y-4">
          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-[#FFFF00]" />
              <span className="text-xs font-semibold text-[#FFFF00]">{t("utilizationByCategory")}</span>
            </div>
            {utilizationData.map((cat) => (
              <div key={cat.category} className="mb-2 last:mb-0" data-testid={`utilization-${cat.category.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/50">{cat.category}</span>
                  <span className={`font-semibold ${cat.pct >= 70 ? "text-emerald-400" : cat.pct >= 50 ? "text-amber-400" : "text-white/60"}`}>{cat.pct}%</span>
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
              <span className="text-xs font-semibold text-emerald-400">{t("fleetHealth")}</span>
            </div>
            {healthMetrics ? (
              <>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/60">{t("overallHealth")}</span>
                  <span className={`font-semibold ${healthMetrics.overall >= 80 ? "text-emerald-400" : "text-amber-400"}`}>{healthMetrics.overall}%</span>
                </div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-white/60">{t("assetsOut")}</span>
                  <span className="font-semibold text-amber-400">{healthMetrics.atRisk}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">{t("inMaintenanceLabel")}</span>
                  <span className="font-semibold text-white/60">{healthMetrics.maintenanceInProgress}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-white/60">{t("noDataYet")}</p>
            )}
          </div>

          <div className="bg-[#111] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-[#FFFF00]" />
              <span className="text-xs font-semibold text-[#FFFF00]">{t("revenueTrend6m")}</span>
            </div>
            <div className="flex items-end gap-1.5 h-20">
              {revenueMonths.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col items-center gap-px">
                    <div className="w-full bg-[#FFFF00]/30 rounded-t" style={{ height: `${(m.revenue / maxRevenue) * 60}px` }} />
                    <div className="w-full bg-emerald-400/30 rounded-b" style={{ height: `${(m.profit / maxRevenue) * 60}px` }} />
                  </div>
                  <span className="text-[9px] text-white/60">{m.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#FFFF00]/30" />{t("revenueLegend")}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400/30" />{t("profitLegend")}</span>
            </div>
            {revenueMonths.length === 0 && (
              <p className="text-xs text-white/60 text-center py-2">{t("noRevenueDataYet")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
