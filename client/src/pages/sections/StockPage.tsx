import { Fragment, useState, useMemo } from "react";
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
  Receipt,
  Pencil,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { BrandCategoryModal } from "./BrandCategoryModal";
import { AddNewItemModal } from "./AddNewItemModal";
import { AddContainerModal } from "./AddContainerModal";
import { ManageContainerUnitsModal } from "./ManageContainerUnitsModal";
import { AddIndividualUnitModal } from "./AddIndividualUnitModal";
import { AddLocationModal } from "./AddLocationModal";
import { AddMaintenanceLogModal } from "./AddMaintenanceLogModal";
import { AddSubRentalModal } from "./AddSubRentalModal";
import { ItemDetailPanel } from "./ItemDetailPanel";
import { StockFilterControlsSection } from "./StockFilterControlsSection";
import { StockFilterSidebarSection } from "./StockFilterSidebarSection";
import { StockItemsTableSection } from "./StockItemsTableSection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { containersApi, jobsApi, maintenanceApi, stockApi } from "@/api";
import type { ContainerWithItems, CrewMember, StockItemWithUnits } from "@/api";

type StockTab = "inventory" | "containers" | "maintenance" | "subrentals";

const stockTabs: { key: StockTab; labelKey: string; icon: typeof Package }[] = [
  { key: "inventory",  labelKey: "tabInventory",   icon: Package },
  { key: "containers", labelKey: "tabContainers",  icon: Box },
  { key: "maintenance",labelKey: "tabMaintenance", icon: Wrench },
  { key: "subrentals", labelKey: "tabSubRentals",  icon: ArrowRightLeft },
];

// กลุ่มสำหรับบันทึกซ่อมบำรุงที่ไม่ได้ผูกกับอุปกรณ์ (general log)
const GENERAL_MAINTENANCE_CATEGORY = "__general__";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  available:   { bg: "bg-emerald-950/60", text: "text-emerald-400", dot: "bg-emerald-400" },
  out:         { bg: "bg-blue-950/60",    text: "text-blue-400",    dot: "bg-blue-400" },
  maintenance: { bg: "bg-amber-950/60",   text: "text-amber-400",   dot: "bg-amber-400" },
  retired:     { bg: "bg-white/5",        text: "text-white/60",    dot: "bg-white/20" },
};

const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation("common");
  const s = statusColors[status] || statusColors.available;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${s.bg} ${s.text} border border-current/20`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${s.dot}`} />
      {t(`statusEnum.${status}`, { defaultValue: status })}
    </span>
  );
};

export const StockPage = (): JSX.Element => {
  const { t } = useTranslation("stock");
  const { t: tc } = useTranslation("common");
  // state ที่ยังเป็น local อยู่ (เฉพาะหน้านี้ ไม่จำเป็นต้อง share)
  const [activeTab, setActiveTab] = useState<StockTab>("inventory");
  const [filterOpen, setFilterOpen] = useState(false);
  const [brandCategoryOpen, setBrandCategoryOpen] = useState(false);
  const [addNewItemOpen, setAddNewItemOpen] = useState(false);
  const [addContainerOpen, setAddContainerOpen] = useState(false);
  const [addIndividualUnitOpen, setAddIndividualUnitOpen] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [addMaintenanceLogOpen, setAddMaintenanceLogOpen] = useState(false);
  const [addSubRentalOpen, setAddSubRentalOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [assignContainer, setAssignContainer] = useState<ContainerWithItems | null>(null);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logForm, setLogForm] = useState({ status: "", cost: "" });
  const [deleteLogTarget, setDeleteLogTarget] = useState<any>(null);
  const [deleteContainerTarget, setDeleteContainerTarget] = useState<ContainerWithItems | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [bulkDeleteLogsOpen, setBulkDeleteLogsOpen] = useState(false);
  const [expandedMaintenanceCategories, setExpandedMaintenanceCategories] = useState<Set<string>>(new Set());

  const { token, expandedContainers, toggleContainer, userRole } = useAppStore();
  const canManage = userRole === "admin" || userRole === "manager";
  const qc = useQueryClient();

  // ดึง containers จาก API (token ถูกส่งอัตโนมัติจาก api client)
  const { data: containers = [] } = useQuery({
    queryKey: ["containers"],
    queryFn: containersApi.getAll,
    enabled: !!token,
  });

  // Mutation สำหรับสร้าง container ใหม่
  const createContainer = useMutation({
    mutationFn: (data: Parameters<typeof containersApi.create>[0]) =>
      containersApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["containers"] }),
  });

  // Mutation สำหรับ check in/out container
  const toggleContainerCheckout = useMutation({
    mutationFn: (id: string) => containersApi.toggleCheckout(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["containers"] }),
  });

  // Mutation สำหรับลบ container
  const deleteContainer = useMutation({
    mutationFn: (id: string) => containersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["containers"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      setDeleteContainerTarget(null);
    },
  });

  // ดึง maintenance + subrentals จาก API
  const { data: maintenanceLogs = [], isLoading: maintenanceLoading } = useQuery({
    queryKey: ["maintenance"],
    queryFn: maintenanceApi.getAll,
    enabled: !!token,
  });

  const { data: subRentals = [], isLoading: subRentalsLoading } = useQuery<any[]>({
    queryKey: ["subrentals"],
    queryFn: maintenanceApi.getSubRentals as () => Promise<any[]>,
    enabled: !!token,
  });

  const createMaintenanceLog = useMutation({
    mutationFn: (data: Parameters<typeof maintenanceApi.createBatch>[0]) => maintenanceApi.createBatch(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });

  const updateMaintenanceLog = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof maintenanceApi.update>[1] }) =>
      maintenanceApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      setEditingLogId(null);
    },
  });

  const deleteMaintenanceLog = useMutation({
    mutationFn: (id: string) => maintenanceApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      setDeleteLogTarget(null);
    },
  });

  const bulkCompleteLogs = useMutation({
    mutationFn: (ids: string[]) => maintenanceApi.updateStatusBatch(ids, "completed"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      setSelectedLogIds(new Set());
    },
  });

  const bulkDeleteLogs = useMutation({
    mutationFn: (ids: string[]) => maintenanceApi.deleteBatch(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      setSelectedLogIds(new Set());
      setBulkDeleteLogsOpen(false);
    },
  });

  const toggleLogSelection = (id: string) =>
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelectAllLogs = () =>
    setSelectedLogIds((prev) =>
      prev.size === maintenanceLogs.length ? new Set() : new Set(maintenanceLogs.map((l: any) => l.id))
    );

  const toggleMaintenanceCategory = (cat: string) =>
    setExpandedMaintenanceCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  // ติ้ก/ยกเลิกติ๊กทั้งหมดของ category นั้นๆ
  const toggleCategorySelection = (logs: any[]) =>
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      const allSelected = logs.every((l) => next.has(l.id));
      for (const l of logs) allSelected ? next.delete(l.id) : next.add(l.id);
      return next;
    });

  const allLogsSelected = maintenanceLogs.length > 0 && selectedLogIds.size === maintenanceLogs.length;
  const someLogsSelected = selectedLogIds.size > 0 && !allLogsSelected;

  const startEditLog = (log: any) => {
    setEditingLogId(log.id);
    setLogForm({ status: log.status, cost: log.cost ?? "" });
  };

  const saveEditLog = (id: string) => {
    updateMaintenanceLog.mutate({
      id,
      data: { status: logForm.status as any, cost: logForm.cost || null },
    });
  };

  // ดึงรายการ stock + units และทีมงาน เพื่อใช้แสดงชื่ออุปกรณ์/ช่างในตารางซ่อมบำรุง
  const { data: stockWithUnits = [] } = useQuery<StockItemWithUnits[]>({
    queryKey: ["stock-with-units"],
    queryFn: stockApi.getAllWithUnits,
    enabled: !!token && activeTab === "maintenance",
  });

  const { data: crewData } = useQuery({
    queryKey: ["crew"],
    queryFn: jobsApi.getCrew,
    enabled: !!token && activeTab === "maintenance",
  });
  const crew: CrewMember[] = crewData?.crew ?? [];

  const unitLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of stockWithUnits) {
      for (const unit of item.units) map.set(unit.id, unit.name);
    }
    return map;
  }, [stockWithUnits]);

  const unitCategoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of stockWithUnits) {
      for (const unit of item.units) map.set(unit.id, item.category);
    }
    return map;
  }, [stockWithUnits]);

  // จัดกลุ่มบันทึกซ่อมบำรุงตาม Category ของอุปกรณ์ (เรียง A→Z, "ทั่วไป" ไว้ล่างสุด)
  const groupedMaintenanceLogs = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const log of maintenanceLogs) {
      const cat = (log.stockUnitId && unitCategoryLookup.get(log.stockUnitId)) || GENERAL_MAINTENANCE_CATEGORY;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(log);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === GENERAL_MAINTENANCE_CATEGORY) return 1;
      if (b === GENERAL_MAINTENANCE_CATEGORY) return -1;
      return a.localeCompare(b);
    });
  }, [maintenanceLogs, unitCategoryLookup]);

  const crewLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of crew) map.set(member.id, member.name);
    return map;
  }, [crew]);

  const createSubRental = useMutation({
    mutationFn: (data: Parameters<typeof maintenanceApi.createSubRental>[0]) => maintenanceApi.createSubRental(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subrentals"] }),
  });

  // Mutation สำหรับสร้าง stock item ใหม่
  const createStockItem = useMutation({
    mutationFn: (data: Parameters<typeof stockApi.create>[0]) => stockApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock"] }),
  });

  // Mutation สำหรับแก้ไข stock item
  const updateStockItem = useMutation({
    mutationFn: (data: Parameters<typeof stockApi.update>[1]) =>
      stockApi.update(selectedItem!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock", selectedItem?.id] });
    },
  });

  // Mutation สำหรับเพิ่ม unit ให้กับ stock item ที่มีอยู่ (เรียกทีละตัว)
  const addStockUnits = useMutation({
    mutationFn: async ({ stockItemId, units }: { stockItemId: string; units: Parameters<typeof stockApi.addUnit>[1][] }) => {
      for (const unit of units) {
        await stockApi.addUnit(stockItemId, unit);
      }
      return stockItemId;
    },
    onSuccess: (stockItemId) => {
      // invalidate list (เพื่อ refresh unitCount) และ detail (เพื่อ refresh expanded units)
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock", stockItemId] });
    },
  });

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
    createContainer.mutate({
      name: data.name,
      type: data.type as any,
      location: data.location,
      barcode: data.barcode,
    });
  };

  return (
    <>
      {brandCategoryOpen && (
        <BrandCategoryModal onClose={() => setBrandCategoryOpen(false)} />
      )}
      {addNewItemOpen && (
        <AddNewItemModal
          onClose={() => setAddNewItemOpen(false)}
          onSubmit={(data) => createStockItem.mutate(data)}
        />
      )}
      {editItemOpen && selectedItem && (
        <AddNewItemModal
          initialItem={selectedItem}
          onClose={() => setEditItemOpen(false)}
          onSubmit={(data) => { updateStockItem.mutate(data); setEditItemOpen(false); }}
        />
      )}
      {addContainerOpen && (
        <AddContainerModal onClose={() => setAddContainerOpen(false)} onAdd={handleAddContainer} />
      )}
      {addIndividualUnitOpen && (
        <AddIndividualUnitModal
          onClose={() => setAddIndividualUnitOpen(false)}
          onSubmit={(stockItemId, units) => addStockUnits.mutate({ stockItemId, units })}
        />
      )}
      {addLocationOpen && (
        <AddLocationModal onClose={() => setAddLocationOpen(false)} />
      )}
      {addMaintenanceLogOpen && (
        <AddMaintenanceLogModal
          onClose={() => setAddMaintenanceLogOpen(false)}
          onSubmit={(data) => createMaintenanceLog.mutate(data)}
        />
      )}
      {addSubRentalOpen && (
        <AddSubRentalModal
          onClose={() => setAddSubRentalOpen(false)}
          onSubmit={(data) => createSubRental.mutate(data)}
        />
      )}
      {assignContainer && (
        <ManageContainerUnitsModal
          container={assignContainer}
          onClose={() => setAssignContainer(null)}
        />
      )}

      <div className="flex items-center gap-1 px-4 pt-3 border-b border-white/[0.06] bg-[#0f0f0f]">
        {stockTabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/60 hover:text-white"}`} data-testid={`tab-stock-${tab.key}`}>
            <tab.icon className="w-3.5 h-3.5" />{t(tab.labelKey)}
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
                  onEdit={() => setEditItemOpen(true)}
                />
              )}
            </div>
          </main>
        </div>
      )}

      {activeTab === "containers" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Action bar */}
          <div className="flex flex-row items-center gap-3 w-full px-4 py-3 border-b border-white/10 bg-[#0f0f0f] flex-shrink-0 animate-fade-in">
            <ScanLine className="w-4 h-4 text-[#FFFF00]/50 flex-shrink-0" />
            <span className="text-sm text-white/60">{t("scanContainerHint")}</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setAddContainerOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#FFFF00" }}
              >
                <Plus className="w-4 h-4" /> {t("addContainer")}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-3">
          {containers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-white/40">
              <Layers className="w-10 h-10 mb-3" />
              <p className="text-sm">{t("noContainersYet")}</p>
            </div>
          )}

          {containers.map((c) => {
            const expanded = expandedContainers.includes(c.id);
            const isOut = c.isOut;
            const readyCount = c.items.filter((i) => i.status === "available").length;
            return (
              <div key={c.id} className={`bg-[#111] border rounded-xl overflow-hidden transition-colors ${isOut ? "border-blue-500/20" : "border-white/[0.06]"}`} data-testid={`container-${c.id}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div onClick={() => toggleContainer(c.id)} className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity">
                    <ChevronRightIcon className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-90 text-[#FFFF00]" : "text-white/60"}`} />
                    <Layers className={`w-4 h-4 ${isOut ? "text-blue-400/60" : "text-[#FFFF00]/60"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white/90 text-sm">{c.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${isOut ? "bg-blue-500/15 text-blue-400" : "bg-[#FFFF00]/10 text-[#FFFF00]/70"}`}>{c.type}</span>
                        {isOut && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-400">
                            {c.jobName ? t("outOnJob", { jobName: c.jobName }) : t("checkedOut")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-white/60 mt-0.5">
                        <span>{c.location}</span>
                        <span className="font-mono">{c.barcode}</span>
                        {c.items.length > 0 && <span>{t("readyOfTotal", { ready: readyCount, total: c.items.length })}</span>}
                        {c.items.length === 0 && <span className="italic">{t("emptyAssignBelow")}</span>}
                      </div>
                    </div>
                  </div>
                  {/* Container actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setAssignContainer(c)}
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-white/10 text-[11px] text-white/60 hover:text-white hover:border-white/20 transition-colors"
                      title={t("assignItemsTooltip")}
                    >
                      <PackagePlus className="w-3 h-3" /> {t("assign")}
                    </button>
                    <button
                      onClick={() => toggleContainerCheckout.mutate(c.id)}
                      disabled={toggleContainerCheckout.isPending}
                      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40 ${
                        isOut
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                      }`}
                    >
                      {isOut ? <><LogIn className="w-3 h-3" /> {t("checkIn")}</> : <><LogOut className="w-3 h-3" /> {t("checkOut")}</>}
                    </button>
                    {canManage && (
                      <button
                        onClick={() => setDeleteContainerTarget(c)}
                        className="p-1.5 rounded-lg text-white/60 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                        title={t("deleteContainer")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-white/[0.04]">
                    {c.items.length === 0 ? (
                      <div className="flex items-center gap-2 px-12 py-4 text-xs text-white/60 italic">
                        <PackagePlus className="w-3.5 h-3.5" />
                        {t("noItemsAssigned")}
                      </div>
                    ) : (
                      c.items.map((item, i) => (
                        <div key={item.id} className="animate-slide-down flex items-center gap-3 px-4 py-2 pl-12 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02]" style={{ animationDelay: `${i * 30}ms` }}>
                          <span className="text-sm text-white/60 flex-1">{item.name}</span>
                          <span className="text-[10px] text-white/60">{item.category}</span>
                          <span className="text-xs font-mono text-white/60">{item.serialNumber ?? "—"}</span>
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

          <AlertDialog open={!!deleteContainerTarget} onOpenChange={(open) => !open && setDeleteContainerTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmDeleteContainerTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("confirmDeleteContainerDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteContainer.isPending}>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteContainerTarget && deleteContainer.mutate(deleteContainerTarget.id)}
                  disabled={deleteContainer.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleteContainer.isPending ? tc("deleting") : tc("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {activeTab === "maintenance" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Action bar */}
          <div className="flex flex-row items-center gap-3 w-full px-4 py-3 border-b border-white/10 bg-[#0f0f0f] flex-shrink-0 animate-fade-in">
            <Wrench className="w-4 h-4 text-[#FFFF00]/60 flex-shrink-0" />
            <span className="text-sm font-semibold text-white/50">{t("maintenanceLog")}</span>
            <span className="text-xs text-white/60">{t("recordsCount", { count: maintenanceLogs.length })}</span>
            {canManage && selectedLogIds.size > 0 && (
              <div className="flex items-center gap-2 animate-fade-in">
                <span className="text-xs text-[#FFFF00]/70 font-semibold">{t("selectedLogsCount", { count: selectedLogIds.size })}</span>
                <button
                  onClick={() => bulkCompleteLogs.mutate(Array.from(selectedLogIds))}
                  disabled={bulkCompleteLogs.isPending}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                >
                  {bulkCompleteLogs.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  {t("markCompletedSelected")}
                </button>
                <button
                  onClick={() => setBulkDeleteLogsOpen(true)}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> {t("deleteSelected")}
                </button>
              </div>
            )}
            <div className="ml-auto">
              <button
                onClick={() => setAddMaintenanceLogOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#FFFF00" }}
              >
                <Plus className="w-4 h-4" /> {t("addLog")}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
          <div className="bg-[#111] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#FFFF00]" />
              <span className="font-bold text-[#FFFF00] text-xs tracking-widest uppercase">{t("maintenanceLog")}</span>
              <span className="text-[10px] text-white/60">{t("recordsCount", { count: maintenanceLogs.length })}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[10px] text-[#FFFF00]/50 uppercase tracking-wider">
                  {canManage && (
                    <th className="py-2.5 pl-4 w-8">
                      <div
                        role="checkbox"
                        aria-checked={allLogsSelected}
                        aria-label={tc("selectAll")}
                        onClick={toggleSelectAllLogs}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all
                          ${allLogsSelected ? "border-[#FFFF00] bg-[#FFFF00]" : someLogsSelected ? "border-[#FFFF00]/60 bg-[#FFFF00]/20" : "border-white/20"}`}
                      >
                        {allLogsSelected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                        {someLogsSelected && <div className="w-1.5 h-0.5 bg-[#FFFF00] rounded-full" />}
                      </div>
                    </th>
                  )}
                  <th className={`py-2.5 text-left font-semibold ${canManage ? "" : "pl-4"}`}>{t("colAsset")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colType")}</th>
                  <th className="py-2.5 text-left font-semibold">{tc("description")}</th>
                  <th className="py-2.5 text-left font-semibold">{tc("date")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colTech")}</th>
                  <th className="py-2.5 text-left font-semibold">{t("colCost")}</th>
                  <th className="py-2.5 text-left font-semibold">{tc("status")}</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`msk-${i}`} className="animate-pulse border-b border-white/[0.04]">
                      {canManage && <td className="py-2.5 pl-4"><div className="h-3.5 w-3.5 rounded bg-white/[0.06]" /></td>}
                      <td className={`py-2.5 ${canManage ? "" : "pl-4"}`}><div className="h-3 rounded bg-white/[0.06] w-28" /></td>
                      <td className="py-2.5"><div className="h-5 rounded bg-white/[0.05] w-16" /></td>
                      <td className="py-2.5"><div className="h-3 rounded bg-white/[0.04]" style={{ width: `${100 + (i * 27) % 100}px` }} /></td>
                      <td className="py-2.5"><div className="h-3 rounded bg-white/[0.04] w-20" /></td>
                      <td className="py-2.5"><div className="h-3 rounded bg-white/[0.04] w-16" /></td>
                      <td className="py-2.5"><div className="h-3 rounded bg-white/[0.05] w-10" /></td>
                      <td className="py-2.5"><div className="h-5 rounded-full bg-white/[0.06] w-20" /></td>
                      <td className="py-2.5 pr-4 text-right"><div className="h-3 rounded bg-white/[0.05] w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : groupedMaintenanceLogs.map(([category, logs]) => {
                  const isCatOpen = expandedMaintenanceCategories.has(category);
                  const inProgressCount = logs.filter((l: any) => l.status === "in_progress").length;
                  const categoryLabel = category === GENERAL_MAINTENANCE_CATEGORY ? t("generalLog") : category;
                  const catAllSelected = logs.length > 0 && logs.every((l: any) => selectedLogIds.has(l.id));
                  const catSomeSelected = !catAllSelected && logs.some((l: any) => selectedLogIds.has(l.id));
                  return (
                  <Fragment key={category}>
                    <tr
                      className="cursor-pointer bg-white/[0.03] hover:bg-white/[0.05] border-b border-white/[0.08] transition-colors select-none"
                      onClick={() => toggleMaintenanceCategory(category)}
                    >
                      <td colSpan={canManage ? 9 : 8} className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {canManage && (
                            <div
                              role="checkbox"
                              aria-checked={catAllSelected}
                              onClick={(e) => { e.stopPropagation(); toggleCategorySelection(logs); }}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all
                                ${catAllSelected ? "border-[#FFFF00] bg-[#FFFF00]" : catSomeSelected ? "border-[#FFFF00]/60 bg-[#FFFF00]/20" : "border-white/20"}`}
                            >
                              {catAllSelected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                              {catSomeSelected && <div className="w-1.5 h-0.5 bg-[#FFFF00] rounded-full" />}
                            </div>
                          )}
                          <ChevronRightIcon className={`w-3.5 h-3.5 flex-shrink-0 text-[#FFFF00]/60 transition-transform duration-200 ${isCatOpen ? "rotate-90" : ""}`} />
                          <Wrench className="w-3.5 h-3.5 text-[#FFFF00]/40 flex-shrink-0" />
                          <span className="font-bold text-xs text-[#FFFF00]">{categoryLabel}</span>
                          <span className="text-[11px] text-white/60">{t("recordsCount", { count: logs.length })}</span>
                          <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            inProgressCount > 0 ? "bg-amber-950/40 text-amber-500" : "bg-emerald-950/40 text-emerald-500"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${inProgressCount > 0 ? "bg-amber-500" : "bg-emerald-500"}`} />
                            {inProgressCount > 0 ? t("inProgressCount", { count: inProgressCount }) : t("allLogsCompleted")}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {isCatOpen && logs.map((log: any) => {
                  const isEditing = editingLogId === log.id;
                  return (
                  <tr key={log.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors" data-testid={`maintenance-${log.id}`}>
                    {canManage && (
                      <td className="py-2.5 pl-4">
                        <div
                          role="checkbox"
                          aria-checked={selectedLogIds.has(log.id)}
                          onClick={() => toggleLogSelection(log.id)}
                          className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all
                            ${selectedLogIds.has(log.id) ? "border-[#FFFF00] bg-[#FFFF00]" : "border-white/20"}`}
                        >
                          {selectedLogIds.has(log.id) && <Check className="w-2 h-2 text-black" strokeWidth={3} />}
                        </div>
                      </td>
                    )}
                    <td className={`py-2.5 font-mono text-[#FFFF00]/70 text-xs ${canManage ? "" : "pl-4"}`}>
                      {log.stockUnitId ? (unitLookup.get(log.stockUnitId) ?? log.stockUnitId) : t("generalLog")}
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        log.type === "repair" ? "bg-red-500/10 text-red-400" : log.type === "preventive" ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-white/60"
                      }`}>{tc(`statusEnum.${log.type}`, { defaultValue: log.type })}</span>
                    </td>
                    <td className="py-2.5 text-white/50 max-w-[250px] truncate">{log.description}</td>
                    <td className="py-2.5 text-white/60 text-xs">{new Date(log.date).toLocaleDateString("en-GB")}</td>
                    <td className="py-2.5 text-white/50">{log.techId ? (crewLookup.get(log.techId) ?? "—") : "—"}</td>
                    <td className="py-2.5 text-white/60 font-semibold">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          className="h-7 w-24 bg-black/50 border border-white/10 rounded px-2 text-xs text-white focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
                          value={logForm.cost}
                          onChange={(e) => setLogForm((f) => ({ ...f, cost: e.target.value }))}
                          placeholder={t("costPlaceholder")}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {log.cost ? `£${log.cost}` : "—"}
                          {log.receiptUrl && (
                            <a href={log.receiptUrl} target="_blank" rel="noopener noreferrer" title="View receipt"
                              className="text-white/60 hover:text-[#FFFF00] transition-colors">
                              <Receipt className="w-3 h-3" />
                            </a>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {isEditing ? (
                        <select
                          className="h-7 w-full bg-black/50 border border-white/10 rounded px-2 text-xs text-white focus:outline-none focus:border-[#FFFF00]/40 transition-colors appearance-none cursor-pointer"
                          value={logForm.status}
                          onChange={(e) => setLogForm((f) => ({ ...f, status: e.target.value }))}
                        >
                          <option value="in_progress" className="bg-[#111]">{tc("statusEnum.in_progress")}</option>
                          <option value="completed" className="bg-[#111]">{tc("statusEnum.completed")}</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${log.status === "completed" ? "text-emerald-400" : "text-amber-400"}`}>
                          {log.status === "completed" ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {tc(`statusEnum.${log.status}`, { defaultValue: log.status })}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 justify-end">
                          <button
                            onClick={() => setEditingLogId(null)}
                            className="h-7 px-2 rounded text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
                          >
                            {tc("cancel")}
                          </button>
                          <button
                            onClick={() => saveEditLog(log.id)}
                            disabled={updateMaintenanceLog.isPending}
                            className="h-7 px-2 rounded text-xs font-bold text-black flex items-center gap-1 disabled:opacity-50 transition-opacity hover:opacity-80"
                            style={{ backgroundColor: "#FFFF00" }}
                          >
                            {updateMaintenanceLog.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            {tc("save")}
                          </button>
                        </div>
                      ) : canManage ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => startEditLog(log)}
                            className="p-1.5 rounded-lg text-white/60 hover:text-[#FFFF00] hover:bg-white/[0.06] transition-colors"
                            title={t("editLog")}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteLogTarget(log)}
                            className="p-1.5 rounded-lg text-white/60 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                            title={t("deleteLog")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  );
                    })}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>

          <AlertDialog open={!!deleteLogTarget} onOpenChange={(open) => !open && setDeleteLogTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmDeleteLogTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("confirmDeleteLogDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMaintenanceLog.isPending}>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteLogTarget && deleteMaintenanceLog.mutate(deleteLogTarget.id)}
                  disabled={deleteMaintenanceLog.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleteMaintenanceLog.isPending ? tc("deleting") : tc("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={bulkDeleteLogsOpen} onOpenChange={setBulkDeleteLogsOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("confirmDeleteLogsTitle", { count: selectedLogIds.size })}</AlertDialogTitle>
                <AlertDialogDescription>{t("confirmDeleteLogsDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={bulkDeleteLogs.isPending}>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => bulkDeleteLogs.mutate(Array.from(selectedLogIds))}
                  disabled={bulkDeleteLogs.isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {bulkDeleteLogs.isPending ? tc("deleting") : tc("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {activeTab === "subrentals" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Action bar */}
          <div className="flex flex-row items-center gap-3 w-full px-4 py-3 border-b border-white/10 bg-[#0f0f0f] flex-shrink-0 animate-fade-in">
            <ArrowRightLeft className="w-4 h-4 text-purple-400/70 flex-shrink-0" />
            <span className="text-sm font-semibold text-white/50">{t("tabSubRentals")}</span>
            <span className="text-xs text-white/60">{t("activeCount", { count: subRentals.length })}</span>
            <span className="flex items-center gap-1.5 text-xs text-purple-400/50 ml-2">
              <Shield className="w-3 h-3" />
              {t("colorCodedNote")}
            </span>
            <div className="ml-auto">
              <button
                onClick={() => setAddSubRentalOpen(true)}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#FFFF00" }}
              >
                <Plus className="w-4 h-4" /> {t("addSubRental")}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
          <div className="bg-[#111] border border-purple-500/15 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-purple-500/10 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-purple-400 text-xs tracking-widest uppercase">{t("tabSubRentals")}</span>
              <span className="text-[10px] text-white/60">{t("activeCount", { count: subRentals.length })}</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {subRentalsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={`srsk-${i}`} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                    <div className="w-1 h-8 rounded-full bg-purple-400/20" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-3.5 rounded bg-white/[0.06]" style={{ width: `${80 + (i * 29) % 60}px` }} />
                        <div className="h-4 rounded bg-purple-500/15 w-12" />
                      </div>
                      <div className="h-2.5 rounded bg-white/[0.04] w-40" />
                    </div>
                    <div className="text-right space-y-1.5">
                      <div className="h-3 rounded bg-white/[0.05] w-16 ml-auto" />
                      <div className="h-2.5 rounded bg-white/[0.04] w-20 ml-auto" />
                    </div>
                  </div>
                ))
              ) : (subRentals as any[]).map((sr) => (
                <div key={sr.id} className="flex items-center gap-4 px-4 py-3 hover:bg-purple-500/[0.03] transition-colors" data-testid={`subrental-${sr.id}`}>
                  <div className="w-1 h-8 rounded-full bg-purple-400/60" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/80">{sr.itemName}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sr.status === "active" ? "bg-purple-500/15 text-purple-400" : "bg-amber-500/15 text-amber-400"}`}>{tc(`statusEnum.${sr.status}`, { defaultValue: sr.status })}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-white/60 mt-0.5">
                      <span>{t("fromPartner", { partner: sr.partner })}</span>
                      <span>{t("jobIdLabel", { id: sr.jobId ?? "—" })}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/50 font-medium inline-flex items-center gap-1.5 justify-end">
                      {sr.dailyRate ? `£${sr.dailyRate}/day` : "—"}
                      {sr.receiptUrl && (
                        <a href={sr.receiptUrl} target="_blank" rel="noopener noreferrer" title="View receipt"
                          className="text-white/60 hover:text-purple-300 transition-colors">
                          <Receipt className="w-3 h-3" />
                        </a>
                      )}
                    </p>
                    <p className="text-[10px] text-white/60 flex items-center gap-1 justify-end"><Clock className="w-3 h-3" />{t("dueLabel", { date: new Date(sr.dueBack).toLocaleDateString("en-GB") })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
};
