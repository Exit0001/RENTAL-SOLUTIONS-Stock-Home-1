import { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Receipt,
  FileText,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  Calculator,
  ShieldAlert,
} from "lucide-react";

type FinanceTab = "quotes" | "invoices" | "costing" | "loss";

const financeTabs: { key: FinanceTab; label: string; icon: typeof DollarSign }[] = [
  { key: "quotes", label: "Quotes", icon: FileText },
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "costing", label: "Costing & ROI", icon: Calculator },
  { key: "loss", label: "Loss Analysis", icon: ShieldAlert },
];

const summaryCards = [
  { label: "Revenue (Month)", value: "£124,800", change: "+14.2%", icon: TrendingUp },
  { label: "Expenses", value: "£41,280", change: "+6.1%", icon: TrendingDown },
  { label: "Net Profit", value: "£83,520", change: "+18.7%", icon: DollarSign },
  { label: "ROI", value: "202%", change: "+4.3%", icon: Target },
];

const quotes = [
  { id: "QT-018", client: "BBC Productions", project: "Summer Broadcast", items: 42, value: "£18,600", stockAvail: "100%", status: "Sent", date: "16 Mar 2026" },
  { id: "QT-017", client: "Universal Music", project: "Album Launch", items: 28, value: "£12,400", stockAvail: "96%", status: "Draft", date: "15 Mar 2026" },
  { id: "QT-016", client: "Tech Conference Ltd", project: "Tech Conference AV", items: 32, value: "£8,200", stockAvail: "100%", status: "Accepted", date: "12 Mar 2026" },
  { id: "QT-015", client: "City Council", project: "City Park Concert", items: 56, value: "£15,300", stockAvail: "88%", status: "Accepted", date: "10 Mar 2026" },
  { id: "QT-014", client: "Wedding Bliss", project: "Wedding Reception", items: 14, value: "£3,800", stockAvail: "100%", status: "Accepted", date: "5 Mar 2026" },
  { id: "QT-013", client: "Starlight Prod.", project: "Theatre Show", items: 24, value: "£9,100", stockAvail: "100%", status: "Declined", date: "1 Mar 2026" },
];

const invoices = [
  { id: "INV-0045", client: "Tech Conference Ltd", amount: "£8,200", date: "15 Mar", due: "30 Mar", status: "Pending", daysLeft: 14 },
  { id: "INV-0044", client: "Wedding Bliss Events", amount: "£3,800", date: "12 Mar", due: "27 Mar", status: "Pending", daysLeft: 11 },
  { id: "INV-0043", client: "Rock Festival GmbH", amount: "£22,400", date: "10 Mar", due: "10 Mar", status: "Overdue", daysLeft: -6 },
  { id: "INV-0042", client: "Festival Sound Co.", amount: "£12,400", date: "8 Mar", due: "23 Mar", status: "Paid", daysLeft: 0 },
  { id: "INV-0041", client: "Corporate Events Inc.", amount: "£6,750", date: "5 Mar", due: "20 Mar", status: "Paid", daysLeft: 0 },
  { id: "INV-0040", client: "City Council", amount: "£15,300", date: "1 Mar", due: "16 Mar", status: "Paid", daysLeft: 0 },
  { id: "INV-0039", client: "University of Arts", amount: "£4,200", date: "28 Feb", due: "15 Mar", status: "Overdue", daysLeft: -1 },
];

const projectCosts = [
  { project: "Festival Sound 2026", revenue: 22400, costs: 6800, staff: 3200, transport: 1200, subRentals: 2800, roi: 229 },
  { project: "Corporate Gala", revenue: 6750, costs: 2100, staff: 1800, transport: 400, subRentals: 0, roi: 221 },
  { project: "Tech Conference AV", revenue: 8200, costs: 2400, staff: 2000, transport: 600, subRentals: 1500, roi: 126 },
  { project: "Wedding Reception", revenue: 3800, costs: 800, staff: 1200, transport: 300, subRentals: 0, roi: 165 },
  { project: "City Park Concert", revenue: 15300, costs: 4200, staff: 4000, transport: 1800, subRentals: 0, roi: 153 },
];

const lossItems = [
  { category: "Lost Equipment", amount: "£2,340", items: 3, trend: "down", desc: "2x SM58, 1x DI Box — unaccounted after Festival Sound" },
  { category: "Damaged Equipment", amount: "£4,860", items: 5, trend: "up", desc: "Repair costs from last 3 jobs" },
  { category: "Late Returns", amount: "£1,200", items: 2, trend: "same", desc: "Sub-rental late fees from Partner Audio Ltd" },
  { category: "Unbilled Hours", amount: "£680", items: 0, trend: "down", desc: "Staff overtime not invoiced to client" },
];

const autoBillingItems = [
  { id: "AB-004", client: "Festival Sound Co.", asset: "SM58-015", type: "Lost", amount: "£280", contract: "Full replacement", status: "Pending" },
  { id: "AB-003", client: "Festival Sound Co.", asset: "SM58-016", type: "Lost", amount: "£280", contract: "Full replacement", status: "Pending" },
  { id: "AB-002", client: "Wedding Bliss", asset: "QSC K12.2-003", type: "Damage", amount: "£120", contract: "Repair cost", status: "Sent" },
  { id: "AB-001", client: "Corporate Events", asset: "XLR20-012", type: "Damage", amount: "£45", contract: "Repair cost", status: "Paid" },
];

const statusColors: Record<string, string> = {
  Paid: "bg-emerald-950/60 text-emerald-400",
  Pending: "bg-amber-950/60 text-amber-400",
  Overdue: "bg-red-950/60 text-red-400",
  Sent: "bg-blue-950/60 text-blue-400",
  Draft: "bg-white/5 text-white/30",
  Accepted: "bg-emerald-950/60 text-emerald-400",
  Declined: "bg-red-950/60 text-red-400",
};

export const FinancePage = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<FinanceTab>("quotes");

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4" data-testid="page-finance">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white" data-testid="text-finance-title">Finance</h1>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-[#111] border border-white/[0.06] rounded-xl p-4" data-testid={`card-${c.label.toLowerCase().replace(/[\s()]/g, "-")}`}>
            <div className="flex items-start justify-between mb-2">
              <div className="p-1.5 rounded-lg bg-[#FFFF00]/10"><c.icon className="w-4 h-4 text-[#FFFF00]" /></div>
              <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-400"><ArrowUpRight className="w-3 h-3" />{c.change}</span>
            </div>
            <p className="text-xl font-bold text-white">{c.value}</p>
            <p className="text-[10px] text-white/25">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {financeTabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/30 hover:text-white/50"}`} data-testid={`tab-${t.key}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === "quotes" && (
        <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#FFFF00]" />
            <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">Smart Quotes</span>
            <span className="ml-auto text-[10px] text-white/20">Linked to live stock availability</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                <th className="py-2.5 pl-4 text-left font-semibold">Quote</th>
                <th className="py-2.5 text-left font-semibold">Client</th>
                <th className="py-2.5 text-left font-semibold">Project</th>
                <th className="py-2.5 text-left font-semibold">Items</th>
                <th className="py-2.5 text-left font-semibold">Value</th>
                <th className="py-2.5 text-left font-semibold">Stock</th>
                <th className="py-2.5 text-left font-semibold">Status</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`row-quote-${q.id}`}>
                  <td className="py-2.5 pl-4 font-mono text-[#FFFF00]/70 text-xs">{q.id}</td>
                  <td className="py-2.5 text-white/60">{q.client}</td>
                  <td className="py-2.5 text-white/40">{q.project}</td>
                  <td className="py-2.5 text-white font-bold">{q.items}</td>
                  <td className="py-2.5 text-white font-semibold">{q.value}</td>
                  <td className="py-2.5">
                    <span className={`text-xs font-semibold ${q.stockAvail === "100%" ? "text-emerald-400" : "text-amber-400"}`}>{q.stockAvail}</span>
                  </td>
                  <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[q.status]}`}>{q.status}</span></td>
                  <td className="py-2.5 pr-4 text-right">
                    <button className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-[#FFFF00] transition-colors" title="Send" data-testid={`button-send-quote-${q.id}`}><Send className="w-3.5 h-3.5" /></button>
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
            <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">Invoices & Payments</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                <th className="py-2.5 pl-4 text-left font-semibold">Invoice</th>
                <th className="py-2.5 text-left font-semibold">Client</th>
                <th className="py-2.5 text-left font-semibold">Amount</th>
                <th className="py-2.5 text-left font-semibold">Issued</th>
                <th className="py-2.5 text-left font-semibold">Due</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`row-invoice-${inv.id}`}>
                  <td className="py-2.5 pl-4 font-mono text-[#FFFF00]/70 text-xs">{inv.id}</td>
                  <td className="py-2.5 text-white/60">{inv.client}</td>
                  <td className="py-2.5 text-white font-semibold">{inv.amount}</td>
                  <td className="py-2.5 text-white/30 text-xs">{inv.date}</td>
                  <td className="py-2.5 text-xs">
                    <span className={inv.status === "Overdue" ? "text-red-400" : "text-white/30"}>{inv.due}</span>
                    {inv.daysLeft < 0 && <span className="ml-1 text-red-400/60 text-[10px]">({Math.abs(inv.daysLeft)}d overdue)</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[inv.status]}`}>
                      {inv.status === "Paid" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {inv.status === "Overdue" && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {inv.status === "Pending" && <Clock className="w-3 h-3 mr-1" />}
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "costing" && (
        <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[#FFFF00]" />
            <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">Project Costing & ROI</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                <th className="py-2.5 pl-4 text-left font-semibold">Project</th>
                <th className="py-2.5 text-left font-semibold">Revenue</th>
                <th className="py-2.5 text-left font-semibold">Equipment</th>
                <th className="py-2.5 text-left font-semibold">Staff</th>
                <th className="py-2.5 text-left font-semibold">Transport</th>
                <th className="py-2.5 text-left font-semibold">Sub-Rentals</th>
                <th className="py-2.5 text-left font-semibold">Profit</th>
                <th className="py-2.5 pr-4 text-right font-semibold">ROI</th>
              </tr>
            </thead>
            <tbody>
              {projectCosts.map((p) => {
                const totalCost = p.costs + p.staff + p.transport + p.subRentals;
                const profit = p.revenue - totalCost;
                return (
                  <tr key={p.project} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`row-cost-${p.project.toLowerCase().replace(/\s+/g, "-")}`}>
                    <td className="py-2.5 pl-4 text-white/80 font-medium">{p.project}</td>
                    <td className="py-2.5 text-emerald-400 font-semibold">£{p.revenue.toLocaleString()}</td>
                    <td className="py-2.5 text-white/40">£{p.costs.toLocaleString()}</td>
                    <td className="py-2.5 text-white/40">£{p.staff.toLocaleString()}</td>
                    <td className="py-2.5 text-white/40">£{p.transport.toLocaleString()}</td>
                    <td className="py-2.5 text-white/40">{p.subRentals ? `£${p.subRentals.toLocaleString()}` : "—"}</td>
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
            <span className="text-xs text-white/30">Total across all projects</span>
            <div className="flex items-center gap-6 text-xs">
              <span className="text-white/50">Revenue: <span className="text-emerald-400 font-bold">£{projectCosts.reduce((s, p) => s + p.revenue, 0).toLocaleString()}</span></span>
              <span className="text-white/50">Profit: <span className="text-emerald-400 font-bold">£{projectCosts.reduce((s, p) => s + p.revenue - p.costs - p.staff - p.transport - p.subRentals, 0).toLocaleString()}</span></span>
              <span className="text-white/50">Avg ROI: <span className="text-[#FFFF00] font-bold">{Math.round(projectCosts.reduce((s, p) => s + p.roi, 0) / projectCosts.length)}%</span></span>
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
                <p className="text-[10px] text-white/25 mt-1">{l.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span className="font-bold text-red-400 text-xs tracking-widest uppercase">Automated Damage/Loss Billing</span>
              <span className="ml-auto text-[10px] text-white/20">Auto-calculated per contract terms</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                  <th className="py-2.5 pl-4 text-left font-semibold">Ref</th>
                  <th className="py-2.5 text-left font-semibold">Client</th>
                  <th className="py-2.5 text-left font-semibold">Asset</th>
                  <th className="py-2.5 text-left font-semibold">Type</th>
                  <th className="py-2.5 text-left font-semibold">Contract</th>
                  <th className="py-2.5 text-left font-semibold">Amount</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {autoBillingItems.map((ab) => (
                  <tr key={ab.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`billing-${ab.id}`}>
                    <td className="py-2.5 pl-4 font-mono text-xs text-white/40">{ab.id}</td>
                    <td className="py-2.5 text-white/60">{ab.client}</td>
                    <td className="py-2.5 font-mono text-xs text-[#FFFF00]/60">{ab.asset}</td>
                    <td className="py-2.5"><span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${ab.type === "Lost" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>{ab.type}</span></td>
                    <td className="py-2.5 text-white/30 text-xs">{ab.contract}</td>
                    <td className="py-2.5 text-red-400 font-semibold">{ab.amount}</td>
                    <td className="py-2.5 pr-4 text-right"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[ab.status]}`}>{ab.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
