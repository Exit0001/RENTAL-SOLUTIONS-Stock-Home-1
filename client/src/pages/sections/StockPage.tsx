import { useState } from "react";
import {
  Package,
  ChevronRightIcon,
  Box,
  Wrench,
  ArrowRightLeft,
  ScanLine,
  Shield,
  CheckCircle2,
  Clock,
  Layers,
  Plus,
  LogOut,
  LogIn,
  PackagePlus,
} from "lucide-react";
import { BrandCategoryModal } from "./BrandCategoryModal";
import { AddNewItemModal } from "./AddNewItemModal";
import { AddContainerModal } from "./AddContainerModal";
import { AddIndividualUnitModal } from "./AddIndividualUnitModal";
import { AddLocationModal } from "./AddLocationModal";
import { ItemDetailPanel } from "./ItemDetailPanel";
import { StockFilterControlsSection } from "./StockFilterControlsSection";
import { StockFilterSidebarSection } from "./StockFilterSidebarSection";
import { StockItemsTableSection } from "./StockItemsTableSection";
import { maintenanceLogs } from "@/data/maintenance";
import { subRentals } from "@/data/subrentals";
import { useAppStore } from "@/store/appStore";

type StockTab = "inventory" | "containers" | "maintenance" | "subrentals";

const stockTabs: { key: StockTab; label: string; icon: typeof Package }[] = [
  { key: "inventory",  label: "Inventory",   icon: Package },
  { key: "containers", label: "Containers",  icon: Box },
  { key: "maintenance",label: "Maintenance", icon: Wrench },
  { key: "subrentals", label: "Sub-Rentals", icon: ArrowRightLeft },
];

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  Ready:       { bg: "bg-emerald-950/60", text: "text-emerald-400", dot: "bg-emerald-400" },
  Out:         { bg: "bg-blue-950/60",    text: "text-blue-400",    dot: "bg-blue-400" },
  Maintenance: { bg: "bg-amber-950/60",   text: "text-amber-400",   dot: "bg-amber-400" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = statusColors[status] || statusColors.Ready;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text} border border-current/20`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${s.dot}`} />
      {status}
    </span>
  );
};

export const StockPage = (): JSX.Element => {
  // state ที่ยังเป็น local อยู่ (เฉพาะหน้านี้ ไม่จำเป็นต้อง share)
  const [activeTab, setActiveTab] = useState<StockTab>("inventory");
  const [filterOpen, setFilterOpen] = useState(false);
  const [brandCategoryOpen, setBrandCategoryOpen] = useState(false);
  const [addNewItemOpen, setAddNewItemOpen] = useState(false);
  const [addContainerOpen, setAddContainerOpen] = useState(false);
  const [addIndividualUnitOpen, setAddIndividualUnitOpen] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // containers ย้ายมาจาก store กลาง — พร้อม actions ทุกอย่าง
  const { containers, expandedContainers, checkedOutContainers, addContainer, toggleContainer, toggleCheckout } = useAppStore();

  const toggleBrand = (brand: string) =>
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );

  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const clearAll = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
  };

  const handleAddContainer = (data: { name: string; type: string; location: string; barcode: string }) => {
    const newContainer = {
      name: data.name,
      type: data.type,
      location: data.location,
      barcode: data.barcode,
    };
    addContainer(newContainer);
  };

  return (
    <>
      {brandCategoryOpen && (
        <BrandCategoryModal onClose={() => setBrandCategoryOpen(false)} />
      )}
      {addNewItemOpen && (
        <AddNewItemModal onClose={() => setAddNewItemOpen(false)} />
      )}
      {addContainerOpen && (
        <AddContainerModal onClose={() => setAddContainerOpen(false)} onAdd={handleAddContainer} />
      )}
      {addIndividualUnitOpen && (
        <AddIndividualUnitModal onClose={() => setAddIndividualUnitOpen(false)} />
      )}
      {addLocationOpen && (
        <AddLocationModal onClose={() => setAddLocationOpen(false)} />
      )}

      <div className="flex items-center gap-1 px-4 pt-3 border-b border-white/[0.06] bg-[#0f0f0f]">
        {stockTabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === t.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/30 hover:text-white/50"}`} data-testid={`tab-stock-${t.key}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {activeTab === "inventory" && (
        <div className="flex flex-row flex-1 overflow-hidden">
          {/* Filter sidebar */}
          <div className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${filterOpen ? "w-52" : "w-0"}`}>
            <StockFilterSidebarSection
              selectedBrands={selectedBrands}
              selectedCategories={selectedCategories}
              onBrandChange={toggleBrand}
              onCategoryChange={toggleCategory}
              onClearAll={clearAll}
            />
          </div>
          {/* Main content */}
          <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <StockFilterControlsSection
              filterOpen={filterOpen}
              onToggleFilter={() => setFilterOpen((v) => !v)}
              onOpenBrandCategory={() => setBrandCategoryOpen(true)}
              onOpenAddLocation={() => setAddLocationOpen(true)}
              onOpenAddNewItem={() => setAddNewItemOpen(true)}
              onOpenAddIndividualUnit={() => setAddIndividualUnitOpen(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
            <div className="flex flex-row flex-1 overflow-hidden">
              <div className="flex-1 overflow-auto p-4">
                <StockItemsTableSection
                  selectedBrands={selectedBrands}
                  selectedCategories={selectedCategories}
                  searchQuery={searchQuery}
                  onViewItem={(item) => setSelectedItem(item as any)}
                  selectedItemId={selectedItem?.id ?? null}
                />
              </div>
              {/* Item detail panel */}
              {selectedItem && (
                <ItemDetailPanel
                  item={selectedItem as any}
                  onClose={() => setSelectedItem(null)}
                  onEdit={() => setAddNewItemOpen(true)}
                />
              )}
            </div>
          </main>
        </div>
      )}

      {activeTab === "containers" && (
        <div className="flex-1 overflow-auto p-6 space-y-3">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-white/30">
              <ScanLine className="w-3.5 h-3.5 text-[#FFFF00]/60" />
              <span>Scan a container barcode to instantly view all contents</span>
            </div>
            <button
              onClick={() => setAddContainerOpen(true)}
              className="flex items-center gap-2 h-8 px-4 rounded-lg text-xs font-bold text-black transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#FFFF00" }}
            >
              <Plus className="w-3.5 h-3.5" /> Add Container
            </button>
          </div>

          {containers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-white/15">
              <Layers className="w-10 h-10 mb-3" />
              <p className="text-sm">No containers yet — add your first one above</p>
            </div>
          )}

          {containers.map((c) => {
            const expanded = expandedContainers.includes(c.id);
            const isOut = checkedOutContainers.has(c.id);
            const readyCount = c.items.filter((i) => i.status === "Ready").length;
            return (
              <div key={c.id} className={`bg-[#111] border rounded-xl overflow-hidden transition-colors ${isOut ? "border-blue-500/20" : "border-white/[0.06]"}`} data-testid={`container-${c.id}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div onClick={() => toggleContainer(c.id)} className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity">
                    <ChevronRightIcon className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-90 text-[#FFFF00]" : "text-white/30"}`} />
                    <Layers className={`w-4 h-4 ${isOut ? "text-blue-400/60" : "text-[#FFFF00]/60"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white/90 text-sm">{c.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${isOut ? "bg-blue-500/15 text-blue-400" : "bg-[#FFFF00]/10 text-[#FFFF00]/70"}`}>{c.type}</span>
                        {isOut && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-400">Out on Job</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-white/30 mt-0.5">
                        <span>{c.location}</span>
                        <span className="font-mono">{c.barcode}</span>
                        {c.items.length > 0 && <span>{readyCount}/{c.items.length} ready</span>}
                        {c.items.length === 0 && <span className="italic">Empty — assign items below</span>}
                      </div>
                    </div>
                  </div>
                  {/* Container actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => {}}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-white/10 text-[11px] text-white/40 hover:text-white hover:border-white/20 transition-colors"
                      title="Assign items to this container"
                    >
                      <PackagePlus className="w-3 h-3" /> Assign
                    </button>
                    <button
                      onClick={() => toggleCheckout(c.id)}
                      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                        isOut
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                      }`}
                    >
                      {isOut ? <><LogIn className="w-3 h-3" /> Check In</> : <><LogOut className="w-3 h-3" /> Check Out</>}
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-white/[0.04]">
                    {c.items.length === 0 ? (
                      <div className="flex items-center gap-2 px-12 py-4 text-xs text-white/20 italic">
                        <PackagePlus className="w-3.5 h-3.5" />
                        No items assigned — click Assign to add items from inventory
                      </div>
                    ) : (
                      c.items.map((item, i) => (
                        <div key={i} className="animate-slide-down flex items-center gap-3 px-4 py-2 pl-12 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]" style={{ animationDelay: `${i * 30}ms` }}>
                          <span className="text-sm text-white/60 flex-1">{item.name}</span>
                          <span className="text-xs font-mono text-white/30">{item.sn}</span>
                          <StatusBadge status={item.status} />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "maintenance" && (
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#FFFF00]" />
              <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">Maintenance Log</span>
              <span className="ml-auto text-[10px] text-white/20">{maintenanceLogs.length} records</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                  <th className="py-2.5 pl-4 text-left font-semibold">Asset</th>
                  <th className="py-2.5 text-left font-semibold">Type</th>
                  <th className="py-2.5 text-left font-semibold">Description</th>
                  <th className="py-2.5 text-left font-semibold">Date</th>
                  <th className="py-2.5 text-left font-semibold">Tech</th>
                  <th className="py-2.5 text-left font-semibold">Cost</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceLogs.map((log) => (
                  <tr key={log.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`maintenance-${log.id}`}>
                    <td className="py-2.5 pl-4 font-mono text-[#FFFF00]/70 text-xs">{log.asset}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        log.type === "Repair" ? "bg-red-500/10 text-red-400" : log.type === "Preventive" ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-white/40"
                      }`}>{log.type}</span>
                    </td>
                    <td className="py-2.5 text-white/50 max-w-[250px] truncate">{log.desc}</td>
                    <td className="py-2.5 text-white/30 text-xs">{log.date}</td>
                    <td className="py-2.5 text-white/50">{log.tech}</td>
                    <td className="py-2.5 text-white/60 font-semibold">{log.cost}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${log.status === "Completed" ? "text-emerald-400" : "text-amber-400"}`}>
                        {log.status === "Completed" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "subrentals" && (
        <div className="flex-1 overflow-auto p-6 space-y-4">
          <div className="flex items-center gap-2 p-3 bg-purple-500/5 border border-purple-500/15 rounded-lg">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-purple-300">Sub-rental items are color-coded differently to prevent mixing with company stock</span>
          </div>
          <div className="bg-[#111] border border-purple-500/15 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-purple-500/10 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-purple-400 text-xs tracking-widest uppercase">Sub-Rentals</span>
              <span className="ml-auto text-[10px] text-white/20">{subRentals.length} active</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {subRentals.map((sr) => (
                <div key={sr.id} className="flex items-center gap-4 px-4 py-3 hover:bg-purple-500/[0.03] transition-colors" data-testid={`subrental-${sr.id}`}>
                  <div className="w-1 h-8 rounded-full bg-purple-400/60" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/80">{sr.item}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sr.status === "Active" ? "bg-purple-500/15 text-purple-400" : "bg-amber-500/15 text-amber-400"}`}>{sr.status}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-white/30 mt-0.5">
                      <span>From: {sr.partner}</span>
                      <span>For: {sr.project}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/50 font-medium">{sr.dailyRate}</p>
                    <p className="text-[10px] text-white/25 flex items-center gap-1"><Clock className="w-3 h-3" />Due: {sr.dueBack}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
