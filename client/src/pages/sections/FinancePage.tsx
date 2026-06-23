import { useState } from "react";
import {
  DollarSign,
  ArrowUpRight,
  Receipt,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Calculator,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Target,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { financeApi } from "@/api";
import { JobExpensesModal } from "./JobExpensesModal";

type FinanceTab = "quotes" | "invoices" | "costing" | "loss";

const financeTabs: { key: FinanceTab; labelKey: string; icon: typeof DollarSign }[] = [
  { key: "quotes",   labelKey: "tabQuotes",   icon: FileText },
  { key: "invoices", labelKey: "tabInvoices", icon: Receipt },
  { key: "costing",  labelKey: "tabCosting",  icon: Calculator },
  { key: "loss",     labelKey: "tabLoss",     icon: ShieldAlert },
];

const statusColors: Record<string, string> = {
  Paid:     "bg-emerald-950/60 text-emerald-400",
  Pending:  "bg-amber-950/60 text-amber-400",
  Overdue:  "bg-red-950/60 text-red-400",
  Sent:     "bg-blue-950/60 text-blue-400",
  Draft:    "bg-white/5 text-white/60",
  Accepted: "bg-emerald-950/60 text-emerald-400",
  Declined: "bg-red-950/60 text-red-400",
};

export const FinancePage = (): JSX.Element => {
  const { t } = useTranslation("finance");
  const { t: tc } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<FinanceTab>("quotes");
  const [expensesJob, setExpensesJob] = useState<{ jobId: string; project: string } | null>(null);
  const { token } = useAppStore();

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes"],
    queryFn: financeApi.getQuotes,
    enabled: !!token,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: financeApi.getInvoices,
    enabled: !!token,
  });

  const { data: projectCosts = [] } = useQuery({
    queryKey: ["finance-costing"],
    queryFn: financeApi.getCosting,
    enabled: !!token,
  });

  const { data: lossData } = useQuery({
    queryKey: ["finance-loss"],
    queryFn: financeApi.getLoss,
    enabled: !!token,
  });

  const lossItems       = lossData?.lossItems       ?? [];
  const autoBillingItems = lossData?.autoBillingItems ?? [];

  // คำนวณ summary cards จาก invoices จริง
  const paidInvoices   = (invoices as any[]).filter(i => i.status === "paid");
  const pendingInvoices= (invoices as any[]).filter(i => i.status === "pending");
  const totalRevenue   = paidInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalPending   = pendingInvoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalQuotes    = (quotes as any[]).filter(q => q.status === "accepted").length;

  const summaryCards = [
    { key: "revenue",    label: t("revenuePaidLabel"),    value: `£${totalRevenue.toLocaleString()}`,   change: "", icon: TrendingUp },
    { key: "outstanding",label: t("outstandingLabel"),    value: `£${totalPending.toLocaleString()}`,   change: "", icon: TrendingDown },
    { key: "quotes",     label: t("quotesAcceptedLabel"), value: `${totalQuotes}`,                       change: "", icon: DollarSign },
    { key: "invoices",   label: t("totalInvoicesLabel"),  value: `${(invoices as any[]).length}`,         change: "", icon: Target },
  ];

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4" data-testid="page-finance">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white" data-testid="text-finance-title">{t("pageTitle")}</h1>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <div key={c.key} className="bg-[#111] border border-white/[0.06] rounded-xl p-4" data-testid={`card-${c.key}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="p-1.5 rounded-lg bg-[#FFFF00]/10"><c.icon className="w-4 h-4 text-[#FFFF00]" /></div>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-400"><ArrowUpRight className="w-3 h-3" />{c.change}</span>
            </div>
            <p className="text-xl font-bold text-white">{c.value}</p>
            <p className="text-[10px] text-white/60">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {financeTabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/60 hover:text-white"}`} data-testid={`tab-${tab.key}`}>
            <tab.icon className="w-3.5 h-3.5" />{t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === "quotes" && (
        <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#FFFF00]" />
            <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">{t("smartQuotes")}</span>
            <span className="ml-auto text-[10px] text-white/60">{t("linkedToStock")}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                <th className="py-2.5 pl-4 text-left font-semibold">{t("colQuote")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colClient")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colProject")}</th>
                <th className="py-2.5 text-left font-semibold">{tc("items")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colValue")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colStock")}</th>
                <th className="py-2.5 text-left font-semibold">{tc("status")}</th>
                <th className="py-2.5 pr-4 text-right font-semibold">{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(quotes as any[]).map((q) => (
                <tr key={q.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`row-quote-${q.id}`}>
                  <td className="py-2.5 pl-4 font-mono text-[#FFFF00]/70 text-xs">{q.quoteNumber ?? q.id}</td>
                  <td className="py-2.5 text-white/60">{q.client}</td>
                  <td className="py-2.5 text-white/60">{q.jobId ?? "—"}</td>
                  <td className="py-2.5 text-white font-bold">—</td>
                  <td className="py-2.5 text-white font-semibold">£{Number(q.totalValue).toLocaleString()}</td>
                  <td className="py-2.5"><span className="text-xs font-semibold text-white/60">—</span></td>
                  <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[q.status] ?? "bg-white/5 text-white/60"}`}>{tc(`statusEnum.${q.status}`, { defaultValue: q.status })}</span></td>
                  <td className="py-2.5 pr-4 text-right">
                    <button className="p-1 rounded hover:bg-white/5 text-white/60 hover:text-[#FFFF00] transition-colors" title={tc("send")} data-testid={`button-send-quote-${q.id}`}><Send className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#FFFF00]" />
            <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">{t("invoicesAndPayments")}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                <th className="py-2.5 pl-4 text-left font-semibold">{t("colInvoice")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colClient")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colAmount")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colIssued")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colDue")}</th>
                <th className="py-2.5 pr-4 text-right font-semibold">{tc("status")}</th>
              </tr>
            </thead>
            <tbody>
              {(invoices as any[]).map((inv) => {
                const daysLeft = Math.round((new Date(inv.dueDate).getTime() - Date.now()) / 86400000);
                return (
                  <tr key={inv.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`row-invoice-${inv.id}`}>
                    <td className="py-2.5 pl-4 font-mono text-[#FFFF00]/70 text-xs">{inv.invoiceNumber ?? inv.id}</td>
                    <td className="py-2.5 text-white/60">{inv.client}</td>
                    <td className="py-2.5 text-white font-semibold">£{Number(inv.amount).toLocaleString()}</td>
                    <td className="py-2.5 text-white/60 text-xs">{new Date(inv.issuedDate).toLocaleDateString("en-GB")}</td>
                    <td className="py-2.5 text-xs">
                      <span className={inv.status === "overdue" ? "text-red-400" : "text-white/60"}>{new Date(inv.dueDate).toLocaleDateString("en-GB")}</span>
                      {daysLeft < 0 && <span className="ml-1 text-red-400/60 text-[10px]">{t("daysOverdue", { days: Math.abs(daysLeft) })}</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[inv.status] ?? "bg-white/5 text-white/60"}`}>
                        {inv.status === "paid"    && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {inv.status === "overdue" && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {inv.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                        {tc(`statusEnum.${inv.status}`, { defaultValue: inv.status })}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "costing" && (
        <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#FFFF00]" />
            <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">{t("projectCostingRoi")}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                <th className="py-2.5 pl-4 text-left font-semibold">{t("colProject")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colRevenue")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colStaff")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colTransport")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colSubRentals")}</th>
                <th className="py-2.5 text-left font-semibold">{t("colProfit")}</th>
                <th className="py-2.5 pr-4 text-right font-semibold">{t("colRoi")}</th>
              </tr>
            </thead>
            <tbody>
              {projectCosts.map((p) => {
                const totalCost = p.staff + p.transport + p.subRentals;
                const profit = p.revenue - totalCost;
                return (
                  <tr key={p.project} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`row-cost-${p.project.toLowerCase().replace(/\s+/g, "-")}`}>
                    <td className="py-2.5 pl-4 text-white/80 font-medium">{p.project}</td>
                    <td className="py-2.5 text-emerald-400 font-semibold">£{p.revenue.toLocaleString()}</td>
                    <td className="py-2.5 text-white/60">
                      <button onClick={() => setExpensesJob({ jobId: p.jobId, project: p.project })}
                        className="hover:text-[#FFFF00] underline-offset-2 hover:underline transition-colors">
                        £{p.staff.toLocaleString()}
                      </button>
                    </td>
                    <td className="py-2.5 text-white/60">
                      <button onClick={() => setExpensesJob({ jobId: p.jobId, project: p.project })}
                        className="hover:text-[#FFFF00] underline-offset-2 hover:underline transition-colors">
                        £{p.transport.toLocaleString()}
                      </button>
                    </td>
                    <td className="py-2.5 text-white/60">{p.subRentals ? `£${p.subRentals.toLocaleString()}` : "—"}</td>
                    <td className="py-2.5 text-emerald-400 font-bold">£{profit.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className={`text-xs font-bold ${p.roi >= 200 ? "text-emerald-400" : p.roi >= 150 ? "text-[#FFFF00]" : "text-amber-400"}`}>{p.roi}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-white/60">{t("totalAcrossProjects")}</span>
            <div className="flex items-center gap-6 text-xs">
              <span className="text-white/50">{t("revenueLabel")} <span className="text-emerald-400 font-bold">£{projectCosts.reduce((s, p) => s + p.revenue, 0).toLocaleString()}</span></span>
              <span className="text-white/50">{t("profitLabel")} <span className="text-emerald-400 font-bold">£{projectCosts.reduce((s, p) => s + p.revenue - p.staff - p.transport - p.subRentals, 0).toLocaleString()}</span></span>
              <span className="text-white/50">{t("avgRoiLabel")} <span className="text-[#FFFF00] font-bold">{projectCosts.length > 0 ? Math.round(projectCosts.reduce((s, p) => s + p.roi, 0) / projectCosts.length) : 0}%</span></span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "loss" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {lossItems.map((l) => (
              <div key={l.category} className="bg-[#111] border border-white/[0.06] rounded-xl p-4" data-testid={`loss-${l.category.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400/60" />
                  <span className="text-xs font-semibold text-white/50">{l.category}</span>
                </div>
                <p className="text-xl font-bold text-red-400">{l.amount}</p>
                <p className="text-[10px] text-white/60 mt-1">{l.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span className="font-bold text-red-400 text-xs tracking-widest uppercase">{t("automatedDamageLossBilling")}</span>
              <span className="ml-auto text-[10px] text-white/60">{t("autoCalculatedHint")}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                  <th className="py-2.5 pl-4 text-left font-semibold">{t("colRef")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colClient")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colAsset")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colType")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colContract")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colAmount")}</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">{tc("status")}</th>
                </tr>
              </thead>
              <tbody>
                {autoBillingItems.map((ab) => {
                  const typeLabels: Record<string, string> = {
                    Lost: t("typeLost"),
                    Damaged: t("typeDamaged"),
                  };
                  return (
                    <tr key={ab.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`billing-${ab.id}`}>
                      <td className="py-2.5 pl-4 font-mono text-xs text-white/60">{ab.id}</td>
                      <td className="py-2.5 text-white/60">{ab.client}</td>
                      <td className="py-2.5 font-mono text-xs text-[#FFFF00]/60">{ab.asset}</td>
                      <td className="py-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${ab.type === "Lost" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>{typeLabels[ab.type] ?? ab.type}</span></td>
                      <td className="py-2.5 text-white/60 text-xs">{ab.contract}</td>
                      <td className="py-2.5 text-red-400 font-semibold">{ab.amount}</td>
                      <td className="py-2.5 pr-4 text-right"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[ab.status]}`}>{tc(`statusEnum.${ab.status}`, { defaultValue: ab.status })}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {expensesJob && (
        <JobExpensesModal
          jobId={expensesJob.jobId}
          jobName={expensesJob.project}
          onClose={() => setExpensesJob(null)}
        />
      )}
    </div>
  );
};
