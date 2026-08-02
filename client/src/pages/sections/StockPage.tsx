import { Fragment, useState, useMemo, useRef } from "react";
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
  Boxes,
  PackageMinus,
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
import { EditContainerModal } from "./EditContainerModal";
import { RackBuildModal } from "./RackBuildModal";
import { ManageContainerUnitsModal } from "./ManageContainerUnitsModal";
import { SetBuilderModal } from "./SetBuilderModal";
import { AddSetsModal } from "./AddSetsModal";
import { DisposeModal, REASON_LABEL } from "./DisposeModal";
import { QuickAddItemsModal, type QuickAddPayload } from "./QuickAddItemsModal";
import { AddLocationModal } from "./AddLocationModal";
import { AddMaintenanceLogModal } from "./AddMaintenanceLogModal";
import { ItemDetailPanel } from "./ItemDetailPanel";
import { AccessoriesModal } from "./AccessoriesModal";
import { StockFilterControlsSection } from "./StockFilterControlsSection";
import { StockFilterSidebarSection } from "./StockFilterSidebarSection";
import { StockItemsTableSection } from "./StockItemsTableSection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ResponsiveTable } from "@/components/ResponsiveTable";
import { DataCard } from "@/components/DataCard";
import { ScrollTabs } from "@/components/ScrollTabs";
import { StockEditModeToggle } from "@/components/StockEditModeToggle";
import { containersApi, disposalsApi, equipmentSetsApi, jobsApi, maintenanceApi, stockApi } from "@/api";
import { useToast } from "@/hooks/use-toast";
import type { ContainerWithItems, CrewMember, DisposalRow, EquipmentSetSummary, StockItemWithUnits, SubRentalWithJob } from "@/api";

type StockTab = "inventory" | "containers" | "sets" | "maintenance" | "subrentals" | "disposals";

const stockTabs: { key: StockTab; labelKey: string; icon: typeof Package }[] = [
  { key: "inventory",  labelKey: "tabInventory",   icon: Package },
  { key: "containers", labelKey: "tabContainers",  icon: Box },
  { key: "sets",       labelKey: "tabSets",        icon: Boxes },
  { key: "maintenance",labelKey: "tabMaintenance", icon: Wrench },
  { key: "subrentals", labelKey: "tabSubRentals",  icon: ArrowRightLeft },
  { key: "disposals",  labelKey: "tabDisposals",   icon: PackageMinus },
];

// กลุ่มสำหรับบันทึกซ่อมบำรุงที่ไม่ได้ผูกกับอุปกรณ์ (general log)
const GENERAL_MAINTENANCE_CATEGORY = "__general__";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  available:   { bg: "bg-emerald-950/60", text: "text-emerald-400", dot: "bg-emerald-400" },
  out:         { bg: "bg-blue-950/60",    text: "text-blue-400",    dot: "bg-blue-400" },
  maintenance: { bg: "bg-amber-950/60",   text: "text-amber-400",   dot: "bg-amber-400" },
  retired:     { bg: "bg-fg/5",        text: "text-fg/60",    dot: "bg-fg/20" },
  sold:        { bg: "bg-red-950/60",     text: "text-red-400",     dot: "bg-red-400" },
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
  const { isMobile } = useBreakpoint();
  // state ที่ยังเป็น local อยู่ (เฉพาะหน้านี้ ไม่จำเป็นต้อง share)
  const [activeTab, setActiveTab] = useState<StockTab>("inventory");
  const [filterOpen, setFilterOpen] = useState(false);
  const [brandCategoryOpen, setBrandCategoryOpen] = useState(false);
  const [addContainerOpen, setAddContainerOpen] = useState(false);
  const [rackBuildOpen, setRackBuildOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [addMaintenanceLogOpen, setAddMaintenanceLogOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [accessoriesItem, setAccessoriesItem] = useState<any>(null);
  const [assignContainer, setAssignContainer] = useState<ContainerWithItems | null>(null);
  const [setBuilderOpen, setSetBuilderOpen] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [addSetsOpen, setAddSetsOpen] = useState(false);
  const [deleteSetTarget, setDeleteSetTarget] = useState<{ id: string; name: string } | null>(null);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logForm, setLogForm] = useState({ status: "", cost: "" });
  const [deleteLogTarget, setDeleteLogTarget] = useState<any>(null);
  const [deleteContainerTarget, setDeleteContainerTarget] = useState<ContainerWithItems | null>(null);
  const [editContainerTarget,   setEditContainerTarget]   = useState<ContainerWithItems | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [bulkDeleteLogsOpen, setBulkDeleteLogsOpen] = useState(false);
  const [expandedMaintenanceCategories, setExpandedMaintenanceCategories] = useState<Set<string>>(new Set());

  const { token, expandedContainers, toggleContainer, userRole, stockEditMode } = useAppStore();
  const { toast } = useToast();
  const canManage = userRole === "admin" || userRole === "manager";
  // ปุ่มแก้ไข/ลบ/เพิ่มสต็อกทั้งหมดต้องปลดล็อกโหมดแก้ไขก่อน (StockEditModeToggle) — กัน
  // การกดผิดที่ทำให้ของหาย ScanModal/assign-checkout ไม่ถูกล็อก เพราะเป็นงานปฏิบัติการ
  const canEdit = canManage && stockEditMode;
  const qc = useQueryClient();

  // ดึง containers จาก API (token ถูกส่งอัตโนมัติจาก api client)
  const { data: containers = [] } = useQuery({
    queryKey: ["containers"],
    queryFn: containersApi.getAll,
    enabled: !!token,
  });

  // ดึงชุดอุปกรณ์ (Equipment Sets)
  const { data: equipmentSets = [] } = useQuery<EquipmentSetSummary[]>({
    queryKey: ["equipment-sets"],
    queryFn: equipmentSetsApi.getAll,
    enabled: !!token,
  });

  // ประวัติการขาย/ตัดของออก
  const { data: disposals = [] } = useQuery<DisposalRow[]>({
    queryKey: ["disposals"],
    queryFn: disposalsApi.getAll,
    enabled: !!token,
  });

  // Mutation ลบชุดอุปกรณ์
  const deleteSet = useMutation({
    mutationFn: (id: string) => equipmentSetsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipment-sets"] });
      setDeleteSetTarget(null);
    },
  });

  // Mutation สำหรับสร้าง container ใหม่ (รับได้ทีละหลายอัน)
  const createContainer = useMutation({
    mutationFn: (items: Parameters<typeof containersApi.create>[0][]) =>
      Promise.all(items.map((data) => containersApi.create(data))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["containers"] }),
  });

  // Mutation สำหรับแก้ไข container (ชื่อ/ประเภท/ตำแหน่ง/บาร์โค้ด)
  const updateContainer = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof containersApi.update>[1] }) =>
      containersApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["containers"] });
      setEditContainerTarget(null);
    },
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

  const { data: subRentals = [], isLoading: subRentalsLoading } = useQuery<SubRentalWithJob[]>({
    queryKey: ["subrentals"],
    queryFn: maintenanceApi.getSubRentals,
    enabled: !!token,
  });

  const createMaintenanceLog = useMutation({
    mutationFn: (data: Parameters<typeof maintenanceApi.createBatch>[0]) => maintenanceApi.createBatch(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      qc.invalidateQueries({ queryKey: ["containers"] });
    },
  });

  const updateMaintenanceLog = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof maintenanceApi.update>[1] }) =>
      maintenanceApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      setEditingLogId(null);
    },
  });

  const deleteMaintenanceLog = useMutation({
    mutationFn: (id: string) => maintenanceApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      setDeleteLogTarget(null);
    },
  });

  const bulkCompleteLogs = useMutation({
    mutationFn: (ids: string[]) => maintenanceApi.updateStatusBatch(ids, "completed"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      setSelectedLogIds(new Set());
    },
  });

  const bulkDeleteLogs = useMutation({
    mutationFn: (ids: string[]) => maintenanceApi.deleteBatch(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["maintenance"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      qc.invalidateQueries({ queryKey: ["containers"] });
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

  const returnSubRental = useMutation({
    mutationFn: (id: string) => maintenanceApi.updateSubRental(id, { status: "returned" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subrentals"] }),
  });


  // Mutation สำหรับแก้ไข stock item
  const updateStockItem = useMutation({
    // id มาจาก variables (ไม่พึ่ง selectedItem ที่อาจเป็น null/คนละตัวกับที่กำลังแก้)
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof stockApi.update>[1] }) =>
      stockApi.update(id, data),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock", id] });
    },
    onError: (err: any) => toast({ title: "ไม่สามารถแก้ไขอุปกรณ์ได้", description: err?.message ?? "เกิดข้อผิดพลาด", variant: "destructive" }),
  });

  // เพิ่มสินค้า: สร้างหลายรุ่น (คนละแบรนด์/หมวดได้) — ราคาต่อรุ่น, วันซื้อ/ประกันต่อ unit; เว้นว่าง = auto
  const quickAddItems = useMutation({
    mutationFn: async (p: QuickAddPayload) => {
      const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "ITEM";
      const toIso = (d: string | null) => (d ? new Date(d).toISOString() : null);
      // สร้างแต่ละรุ่นพร้อมกัน (ไม่รอทีละรุ่น) — แต่ละรุ่นไม่ผูกกัน ทำแบบ sequential แล้ว
      // ช้าโดยไม่จำเป็น เพราะ round-trip ไปยัง Supabase pooler คือต้นทุนหลัก
      await Promise.all(p.rows.map(async (row) => {
        const item = await stockApi.create({
          name: row.name,
          brand: row.brand,
          category: row.category,
          subCategory: row.subCategory,
          trackingMode: p.trackingMode,
          quantity: p.trackingMode === "bulk" ? row.qty : 0,
          manufacturer: p.manufacturer || null,
          manufacturerCountry: p.manufacturerCountry || null,
          purchaseCost: row.purchaseCost || null,
          dailyRate: row.dailyRate || null,
        } as Parameters<typeof stockApi.create>[0]);
        if (p.trackingMode === "unit" && row.qty > 0) {
          const pre = slug(row.name);
          const units = Array.from({ length: row.qty }, (_, i) => {
            const d = row.units?.[i];
            return {
              name: `${row.name} #${String(i + 1).padStart(2, "0")}`,
              serialNumber: d?.serial ?? null,
              barcode: d?.barcode ?? `${pre}-${String(i + 1).padStart(3, "0")}`,
              location: p.location || null,
              status: "available",
              purchasedAt: toIso(d?.purchasedAt ?? null),
              warrantyExpiresAt: toIso(d?.warrantyExpiresAt ?? null),
            };
          });
          await stockApi.addUnitsBatch(item.id, units as Parameters<typeof stockApi.addUnitsBatch>[1]);
        }
      }));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      setQuickAddOpen(false);
      toast({ title: "เพิ่มสำเร็จ" });
    },
    onError: (err: any) => toast({ title: "เพิ่มไม่สำเร็จ", description: err?.message ?? "เกิดข้อผิดพลาด", variant: "destructive" }),
  });

  const toggleBrand = (brand: string) =>
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );

  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const toggleSubCategory = (sub: string) =>
    setSelectedSubCategories((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );

  const clearAll = () => {
    setSelectedBrands([]);
    setSelectedCategories([]);
    setSelectedSubCategories([]);
  };

  const handleAddContainer = (items: { name: string; type: string; location: string; barcode: string; imageUrl: string | null }[]) => {
    createContainer.mutate(
      items.map((data) => ({
        name: data.name,
        type: data.type as any,
        location: data.location,
        barcode: data.barcode,
        imageUrl: data.imageUrl,
      }))
    );
  };

  // ปัดซ้าย-ขวาเปลี่ยนแท็บบนมือถือ (วนกลับเมื่อสุดขอบ) — คู่กับแถบแท็บด้านล่างจอ
  // (mobile bottom tab bar ด้านล่าง). ใช้ touchstart/touchend เท่านั้น (ไม่ preventDefault
  // ระหว่างทาง) ไม่ให้ไปแย่ง scroll แนวตั้งหรือการแตะปุ่ม/แถวที่ขยายได้ปกติ
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const goToAdjacentTab = (direction: 1 | -1) => {
    const i = stockTabs.findIndex((tb) => tb.key === activeTab);
    const next = (i + direction + stockTabs.length) % stockTabs.length;
    setActiveTab(stockTabs[next].key);
  };
  const handleTabSwipeStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const handleTabSwipeEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    const isSwipe = Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 600;
    if (!isSwipe) return;
    goToAdjacentTab(dx < 0 ? 1 : -1);
  };

  return (
    <>
      {brandCategoryOpen && (
        <BrandCategoryModal onClose={() => setBrandCategoryOpen(false)} />
      )}
      {editItemOpen && editingItem && (
        <AddNewItemModal
          initialItem={editingItem}
          onClose={() => { setEditItemOpen(false); setEditingItem(null); }}
          onSubmit={(data) => { if (editingItem) updateStockItem.mutate({ id: editingItem.id, data }); setEditItemOpen(false); setEditingItem(null); }}
        />
      )}
      {addContainerOpen && (
        <AddContainerModal onClose={() => setAddContainerOpen(false)} onAdd={handleAddContainer} />
      )}
      {editContainerTarget && (
        <EditContainerModal
          container={editContainerTarget}
          onClose={() => setEditContainerTarget(null)}
          onSave={(id, data) => updateContainer.mutate({ id, data })}
        />
      )}
      <RackBuildModal open={rackBuildOpen} onClose={() => setRackBuildOpen(false)} />
      {quickAddOpen && (
        <QuickAddItemsModal
          onClose={() => setQuickAddOpen(false)}
          onSubmit={(payload) => quickAddItems.mutate(payload)}
          isPending={quickAddItems.isPending}
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
      {assignContainer && (
        <ManageContainerUnitsModal
          containers={containers}
          initialContainerId={assignContainer.id}
          onClose={() => setAssignContainer(null)}
        />
      )}
      {setBuilderOpen && (
        <SetBuilderModal
          setId={editingSetId}
          onClose={() => { setSetBuilderOpen(false); setEditingSetId(null); }}
        />
      )}
      {addSetsOpen && <AddSetsModal onClose={() => setAddSetsOpen(false)} />}
      {disposeOpen && <DisposeModal onClose={() => setDisposeOpen(false)} />}

      {/* Desktop/tablet: tabs live in this top bar (ScrollTabs). Mobile: tabs move to
          a fixed bottom bar (below) — reachable with a thumb — and this strip just
          keeps the edit-lock toggle visible; ScrollTabs itself is hidden, not unmounted
          state-wise, it's the same activeTab driving both. */}
      <div className="flex items-center gap-2 pr-2 md:pr-4 py-2 md:py-0 border-b border-fg/[0.06] bg-surface-1 flex-shrink-0">
        <ScrollTabs
          tabs={stockTabs.map((tab) => ({ key: tab.key, label: t(tab.labelKey), Icon: tab.icon }))}
          active={activeTab}
          onChange={(k) => setActiveTab(k as StockTab)}
          variant="underline"
          className="hidden md:block flex-1 min-w-0 px-2 md:px-4 pt-2 md:pt-3"
          testIdPrefix="tab-stock"
        />
        {canManage && <div className="ml-auto"><StockEditModeToggle /></div>}
      </div>

      {/* Swipe left/right on mobile to move between tabs, wrapping at the ends —
          pairs with the bottom tab bar below. touchstart/touchend only (no
          preventDefault mid-gesture) so vertical scroll and taps are untouched. */}
      <div
        className="flex flex-col flex-1 overflow-hidden"
        onTouchStart={handleTabSwipeStart}
        onTouchEnd={handleTabSwipeEnd}
      >
      {activeTab === "inventory" && (
        <div className="flex flex-row flex-1 overflow-hidden">
          {/* Filter sidebar — inline rail on tablet/desktop only. On mobile the same
              component is rendered inside a left Sheet (below) so it gets the full
              screen width instead of a 236px sliver. */}
          <div className={`hidden md:block flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${filterOpen ? "w-52" : "w-0"}`}>
            <StockFilterSidebarSection
              selectedBrands={selectedBrands}
              selectedCategories={selectedCategories}
              selectedSubCategories={selectedSubCategories}
              onBrandChange={toggleBrand}
              onCategoryChange={toggleCategory}
              onSubCategoryChange={toggleSubCategory}
              onClearAll={clearAll}
            />
          </div>
          {isMobile && (
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetContent side="left" overlayClassName="z-[70]" className="z-[70] w-[88vw] max-w-[320px] p-0 bg-surface-1 text-fg border-r border-fg/[0.06] gap-0">
                <StockFilterSidebarSection
                  selectedBrands={selectedBrands}
                  selectedCategories={selectedCategories}
                  selectedSubCategories={selectedSubCategories}
                  onBrandChange={toggleBrand}
                  onCategoryChange={toggleCategory}
                  onSubCategoryChange={toggleSubCategory}
                  onClearAll={clearAll}
                />
              </SheetContent>
            </Sheet>
          )}
          {/* Main content */}
          <main className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <StockFilterControlsSection
              filterOpen={filterOpen}
              onToggleFilter={() => setFilterOpen((v) => !v)}
              onOpenBrandCategory={() => setBrandCategoryOpen(true)}
              onOpenAddLocation={() => setAddLocationOpen(true)}
              onOpenQuickAdd={() => setQuickAddOpen(true)}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
            <div className="flex flex-row flex-1 overflow-hidden">
              <div className="flex-1 overflow-auto p-2 pb-24 md:p-4">
                <StockItemsTableSection
                  selectedBrands={selectedBrands}
                  selectedCategories={selectedCategories}
                  selectedSubCategories={selectedSubCategories}
                  searchQuery={searchQuery}
                  onViewItem={(item) => setSelectedItem(item as any)}
                  onEditItem={(item) => { setEditingItem(item as any); setEditItemOpen(true); }}
                  onManageAccessories={(item) => setAccessoriesItem(item as any)}
                  selectedItemId={selectedItem?.id ?? null}
                />
              </div>
              {/* Item detail panel */}
              {selectedItem && (
                <ItemDetailPanel
                  item={selectedItem as any}
                  onClose={() => setSelectedItem(null)}
                />
              )}
              {accessoriesItem && (
                <AccessoriesModal
                  item={accessoriesItem as any}
                  onClose={() => setAccessoriesItem(null)}
                />
              )}
            </div>
          </main>
        </div>
      )}

      {activeTab === "containers" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Action bar */}
          <div className="h-scroll flex flex-row items-center gap-2 md:gap-3 w-full px-3 md:px-4 py-2.5 md:py-3 border-b border-fg/[0.06] bg-surface-1 flex-shrink-0 animate-fade-in [&>*]:flex-shrink-0">
            {stockEditMode && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setRackBuildOpen(true)}
                  className="flex items-center gap-2 h-11 md:h-9 px-4 rounded-xl md:rounded-lg text-sm font-bold border border-brand/40 text-brand transition-opacity hover:opacity-90 hover:bg-brand/10"
                >
                  <ScanLine className="w-4 h-4" /> Rack Build Mode
                </button>
                <button
                  onClick={() => setAddContainerOpen(true)}
                  className="flex items-center gap-2 h-11 md:h-9 px-4 rounded-xl md:rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  <Plus className="w-4 h-4" /> {t("addContainer")}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-2.5 pb-24 md:p-4">
          {containers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-fg/40">
              <Layers className="w-10 h-10" />
              <p className="text-sm">{t("noContainersYet")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3 items-start">
              {containers.map((c) => {
                const expanded = expandedContainers.includes(c.id);
                const isOut = c.isOut;
                const readyCount = c.items.filter((i) => i.status === "available").length;
                return (
                  <div key={c.id} className={`rounded-xl border bg-surface-1 overflow-hidden transition-colors ${isOut ? "border-blue-500/20" : "border-fg/[0.08] hover:border-brand/30"}`} data-testid={`container-${c.id}`}>
                    <div className="flex">
                      {c.imageUrl
                        ? <img src={c.imageUrl} alt="" className="w-16 h-16 md:w-24 md:h-24 object-cover flex-shrink-0" />
                        : (
                          <div className={`w-16 h-16 md:w-24 md:h-24 flex items-center justify-center flex-shrink-0 ${isOut ? "bg-blue-500/[0.06]" : "bg-brand/[0.06]"}`}>
                            <Layers className={`w-5 h-5 md:w-6 md:h-6 ${isOut ? "text-blue-400/40" : "text-brand/40"}`} />
                          </div>
                        )}
                      <div className="flex-1 min-w-0 p-2.5 md:p-3 flex flex-col">
                        <div onClick={() => toggleContainer(c.id)} className="cursor-pointer hover:opacity-80 transition-opacity">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13px] md:text-sm font-bold text-fg truncate">{c.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${isOut ? "bg-blue-500/15 text-blue-400" : "bg-brand/10 text-brand/70"}`}>{c.type}</span>
                            {isOut && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-400">
                                {c.jobName ? t("outOnJob", { jobName: c.jobName }) : t("checkedOut")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] md:text-[11px] text-fg/50 mt-0.5">
                            <ChevronRightIcon className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${expanded ? "rotate-90 text-brand" : ""}`} />
                            <span className="truncate">{c.location}</span>
                            {c.barcode && <span className="font-mono truncate">{c.barcode}</span>}
                          </div>
                          <p className="text-[10px] md:text-[11px] text-fg/40 mt-0.5">
                            {c.items.length > 0
                              ? t("readyOfTotal", { ready: readyCount, total: c.items.length })
                              : <span className="italic">{t("emptyAssignBelow")}</span>}
                          </p>
                        </div>

                        <div className="mt-auto flex items-center gap-1.5 md:gap-2 pt-1.5 md:pt-2 flex-wrap">
                          <button
                            onClick={() => setAssignContainer(c)}
                            className="flex items-center gap-1 h-7 px-2 md:px-2.5 rounded-lg text-[11px] font-semibold bg-fg/[0.06] text-fg/70 hover:bg-fg/10 transition-colors"
                            title={t("assignItemsTooltip")}
                          >
                            <PackagePlus className="w-3 h-3" /> {t("assign")}
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => setEditContainerTarget(c)}
                              className="flex items-center gap-1 h-7 px-2 md:px-2.5 rounded-lg text-[11px] font-semibold bg-fg/[0.06] text-fg/70 hover:bg-fg/10 transition-colors"
                              title={t("editContainer")}
                            >
                              <Pencil className="w-3 h-3" /> {tc("edit")}
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => setDeleteContainerTarget(c)}
                              className="flex items-center gap-1 h-7 px-2 md:px-2.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                              title={t("deleteContainer")}
                            >
                              <Trash2 className="w-3 h-3" /> {tc("delete")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {expanded && (
                      <div className="border-t border-fg/[0.06]">
                        <div className="flex items-center justify-between px-3 md:px-4 py-1.5 md:py-2 border-b border-fg/[0.06]">
                          <span className="text-[10px] font-bold text-fg/40 uppercase tracking-wider">{t("equipmentLabel")}</span>
                          <button
                            onClick={() => toggleContainerCheckout.mutate(c.id)}
                            disabled={toggleContainerCheckout.isPending}
                            className={`flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40 ${
                              isOut
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                            }`}
                          >
                            {isOut ? <><LogIn className="w-3 h-3" /> {t("checkIn")}</> : <><LogOut className="w-3 h-3" /> {t("checkOut")}</>}
                          </button>
                        </div>
                        {c.items.length === 0 ? (
                          <div className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-3 text-xs text-fg/60 italic">
                            <PackagePlus className="w-3.5 h-3.5" />
                            {t("noItemsAssigned")}
                          </div>
                        ) : (
                          c.items.map((item, i) => (
                            <div key={item.id} className="animate-slide-down flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 border-b border-fg/[0.03] last:border-0 hover:bg-fg/[0.02]" style={{ animationDelay: `${i * 30}ms` }}>
                              <span className="text-xs text-fg/60 flex-1 truncate">{item.name}</span>
                              <span className="text-[10px] text-fg/50 flex-shrink-0">{item.category}</span>
                              <span className="text-[10px] font-mono text-fg/50 flex-shrink-0">{item.serialNumber ?? "—"}</span>
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
                  className="bg-red-600 hover:bg-red-700 text-fg"
                >
                  {deleteContainer.isPending ? tc("deleting") : tc("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {activeTab === "sets" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Action bar */}
          <div className="h-scroll flex flex-row items-center gap-2 md:gap-3 w-full px-3 md:px-4 py-2.5 md:py-3 border-b border-fg/[0.06] bg-surface-1 flex-shrink-0 animate-fade-in [&>*]:flex-shrink-0">
            <Boxes className="w-4 h-4 text-brand/60 flex-shrink-0" />
            <span className="text-sm font-semibold text-fg/50">{t("tabSets")}</span>
            <span className="text-xs text-fg/60">{equipmentSets.length}</span>
            {stockEditMode && (
              <div className="ml-auto">
                <button
                  onClick={() => setAddSetsOpen(true)}
                  className="flex items-center gap-2 h-11 md:h-9 px-4 rounded-xl md:rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  <Plus className="w-4 h-4" /> สร้างชุด
                </button>
              </div>
            )}
          </div>

          {/* Grid of sets */}
          <div className="flex-1 overflow-auto p-2.5 pb-24 md:p-4">
            {equipmentSets.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-fg/40">
                <Boxes className="w-10 h-10" />
                <p className="text-sm">ยังไม่มีชุดอุปกรณ์ — คลิก "สร้างชุด" เพื่อรวมของที่ใช้ด้วยกันบ่อยๆ เป็นชุดเดียว</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                {equipmentSets.map((s) => (
                  <div key={s.id} className="rounded-xl border border-fg/[0.08] bg-surface-1 overflow-hidden hover:border-brand/30 transition-colors">
                    <div className="flex">
                      {s.imageUrl
                        ? <img src={s.imageUrl} alt="" className="w-16 h-16 md:w-24 md:h-24 object-cover flex-shrink-0" />
                        : <div className="w-16 h-16 md:w-24 md:h-24 bg-brand/[0.06] flex items-center justify-center flex-shrink-0"><Layers className="w-5 h-5 md:w-6 md:h-6 text-brand/40" /></div>}
                      <div className="flex-1 min-w-0 p-2.5 md:p-3 flex flex-col">
                        <p className="text-[13px] md:text-sm font-bold text-fg truncate">{s.name}</p>
                        <p className="text-[10px] md:text-[11px] text-fg/50 mt-0.5">{s.itemCount} รายการ · {s.totalQty} ชิ้น</p>
                        {s.description && <p className="text-[10px] md:text-[11px] text-fg/40 mt-1 line-clamp-2">{s.description}</p>}
                        <div className="mt-auto flex items-center gap-1.5 md:gap-2 pt-1.5 md:pt-2">
                          {stockEditMode && (
                            <button
                              onClick={() => { setEditingSetId(s.id); setSetBuilderOpen(true); }}
                              className="flex items-center gap-1 h-7 px-2 md:px-2.5 rounded-lg text-[11px] font-semibold bg-fg/[0.06] text-fg/70 hover:bg-fg/10 transition-colors"
                            >
                              <Pencil className="w-3 h-3" /> แก้ไข
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => setDeleteSetTarget({ id: s.id, name: s.name })}
                              className="flex items-center gap-1 h-7 px-2 md:px-2.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" /> ลบ
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <AlertDialog open={!!deleteSetTarget} onOpenChange={(open) => !open && setDeleteSetTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>ลบชุดอุปกรณ์?</AlertDialogTitle>
                <AlertDialogDescription>
                  ลบชุด "{deleteSetTarget?.name}" — การลบชุดไม่กระทบของที่เพิ่มเข้างานไปแล้ว
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteSet.isPending}>{tc("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteSetTarget && deleteSet.mutate(deleteSetTarget.id)}
                  disabled={deleteSet.isPending}
                  className="bg-red-600 hover:bg-red-700 text-fg"
                >
                  {deleteSet.isPending ? tc("deleting") : tc("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {activeTab === "maintenance" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Action bar */}
          <div className="h-scroll flex flex-row items-center gap-2 md:gap-3 w-full px-3 md:px-4 py-2.5 md:py-3 border-b border-fg/[0.06] bg-surface-1 flex-shrink-0 animate-fade-in [&>*]:flex-shrink-0">
            <Wrench className="w-4 h-4 text-brand/60 flex-shrink-0" />
            <span className="text-sm font-semibold text-fg/50">{t("maintenanceLog")}</span>
            <span className="text-xs text-fg/60">{t("recordsCount", { count: maintenanceLogs.length })}</span>
            {canEdit && selectedLogIds.size > 0 && (
              <div className="flex items-center gap-2 animate-fade-in">
                <span className="text-xs text-brand/70 font-semibold">{t("selectedLogsCount", { count: selectedLogIds.size })}</span>
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
            {stockEditMode && (
              <div className="ml-auto">
                <button
                  onClick={() => setAddMaintenanceLogOpen(true)}
                  className="flex items-center gap-2 h-11 md:h-9 px-4 rounded-xl md:rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--brand)" }}
                >
                  <Plus className="w-4 h-4" /> {t("addLog")}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-2 pb-24 md:p-6">
          <div className="bg-surface-1 border border-fg/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-fg/[0.06] flex items-center gap-2">
              <Wrench className="w-4 h-4 text-brand flex-shrink-0" aria-hidden="true" />
              <span className="font-bold text-brand text-xs tracking-widest uppercase">{t("maintenanceLog")}</span>
              <span className="text-[10px] text-fg/60">{t("recordsCount", { count: maintenanceLogs.length })}</span>
            </div>
            <ResponsiveTable
              table={
            <div className="h-scroll">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-fg/[0.06] text-[10px] text-brand/50 uppercase tracking-wider">
                  {canEdit && <th className="py-2.5 pl-4 w-8" />}
                  <th className={`py-2.5 text-left font-semibold ${canEdit ? "" : "pl-4"}`}>{t("colAsset")}</th>
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
                    <tr key={`msk-${i}`} className="animate-pulse border-b border-fg/[0.04]">
                      {canEdit && <td className="py-2.5 pl-4"><div className="h-3.5 w-3.5 rounded bg-fg/[0.06]" /></td>}
                      <td className={`py-2.5 ${canEdit ? "" : "pl-4"}`}><div className="h-3 rounded bg-fg/[0.06] w-28" /></td>
                      <td className="py-2.5"><div className="h-5 rounded bg-fg/[0.05] w-16" /></td>
                      <td className="py-2.5"><div className="h-3 rounded bg-fg/[0.04]" style={{ width: `${100 + (i * 27) % 100}px` }} /></td>
                      <td className="py-2.5"><div className="h-3 rounded bg-fg/[0.04] w-20" /></td>
                      <td className="py-2.5"><div className="h-3 rounded bg-fg/[0.04] w-16" /></td>
                      <td className="py-2.5"><div className="h-3 rounded bg-fg/[0.05] w-10" /></td>
                      <td className="py-2.5"><div className="h-5 rounded-full bg-fg/[0.06] w-20" /></td>
                      <td className="py-2.5 pr-4 text-right"><div className="h-3 rounded bg-fg/[0.05] w-16 ml-auto" /></td>
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
                      className="cursor-pointer bg-fg/[0.03] hover:bg-fg/[0.05] border-b border-fg/[0.08] transition-colors select-none"
                      onClick={() => toggleMaintenanceCategory(category)}
                    >
                      <td colSpan={canEdit ? 9 : 8} className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {canEdit && (
                            <div
                              role="checkbox"
                              aria-checked={catAllSelected}
                              onClick={(e) => { e.stopPropagation(); toggleCategorySelection(logs); }}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all
                                ${catAllSelected ? "border-brand bg-brand" : catSomeSelected ? "border-brand/60 bg-brand/20" : "border-fg/20"}`}
                            >
                              {catAllSelected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                              {catSomeSelected && <div className="w-1.5 h-0.5 bg-brand rounded-full" />}
                            </div>
                          )}
                          <ChevronRightIcon className={`w-3.5 h-3.5 flex-shrink-0 text-brand/60 transition-transform duration-200 ${isCatOpen ? "rotate-90" : ""}`} />
                          <Wrench className="w-3.5 h-3.5 text-brand/40 flex-shrink-0" />
                          <span className="font-bold text-xs text-brand">{categoryLabel}</span>
                          <span className="text-[11px] text-fg/60">{t("recordsCount", { count: logs.length })}</span>
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
                  <tr key={log.id} className="border-b border-fg/[0.04] hover:bg-fg/[0.02] transition-colors" data-testid={`maintenance-${log.id}`}>
                    {canEdit && (
                      <td className="py-2.5 pl-4">
                        <div
                          role="checkbox"
                          aria-checked={selectedLogIds.has(log.id)}
                          onClick={() => toggleLogSelection(log.id)}
                          className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all
                            ${selectedLogIds.has(log.id) ? "border-brand bg-brand" : "border-fg/20"}`}
                        >
                          {selectedLogIds.has(log.id) && <Check className="w-2 h-2 text-black" strokeWidth={3} />}
                        </div>
                      </td>
                    )}
                    <td className={`py-2.5 font-mono text-brand/70 text-xs ${canEdit ? "" : "pl-4"}`}>
                      {log.stockUnitId ? (unitLookup.get(log.stockUnitId) ?? log.stockUnitId) : t("generalLog")}
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        log.type === "repair" ? "bg-red-500/10 text-red-400" : log.type === "preventive" ? "bg-blue-500/10 text-blue-400" : "bg-fg/5 text-fg/60"
                      }`}>{tc(`statusEnum.${log.type}`, { defaultValue: log.type })}</span>
                    </td>
                    <td className="py-2.5 text-fg/50 max-w-[250px] truncate">{log.description}</td>
                    <td className="py-2.5 text-fg/60 text-xs">{new Date(log.date).toLocaleDateString("en-GB")}</td>
                    <td className="py-2.5 text-fg/50">{log.techId ? (crewLookup.get(log.techId) ?? "—") : "—"}</td>
                    <td className="py-2.5 text-fg/60 font-semibold">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          className="h-7 w-24 bg-black/50 border border-fg/10 rounded px-2 text-xs text-fg focus:outline-none focus:border-brand/40 transition-colors"
                          value={logForm.cost}
                          onChange={(e) => setLogForm((f) => ({ ...f, cost: e.target.value }))}
                          placeholder={t("costPlaceholder")}
                        />
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {log.cost ? `£${log.cost}` : "—"}
                          {log.receiptUrl && (
                            <a href={log.receiptUrl} target="_blank" rel="noopener noreferrer" title="View receipt"
                              className="text-fg/60 hover:text-brand transition-colors">
                              <Receipt className="w-3 h-3" />
                            </a>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      {isEditing ? (
                        <select
                          className="h-7 w-full bg-black/50 border border-fg/10 rounded px-2 text-xs text-fg focus:outline-none focus:border-brand/40 transition-colors appearance-none cursor-pointer"
                          value={logForm.status}
                          onChange={(e) => setLogForm((f) => ({ ...f, status: e.target.value }))}
                        >
                          <option value="in_progress" className="bg-surface-1">{tc("statusEnum.in_progress")}</option>
                          <option value="completed" className="bg-surface-1">{tc("statusEnum.completed")}</option>
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
                            className="h-7 px-2 rounded text-xs text-fg/60 hover:text-fg border border-fg/10 hover:border-fg/20 transition-colors"
                          >
                            {tc("cancel")}
                          </button>
                          <button
                            onClick={() => saveEditLog(log.id)}
                            disabled={updateMaintenanceLog.isPending}
                            className="h-7 px-2 rounded text-xs font-bold text-black flex items-center gap-1 disabled:opacity-50 transition-opacity hover:opacity-80"
                            style={{ backgroundColor: "var(--brand)" }}
                          >
                            {updateMaintenanceLog.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            {tc("save")}
                          </button>
                        </div>
                      ) : canEdit ? (
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => startEditLog(log)}
                            className="p-1.5 rounded-lg text-fg hover:text-brand hover:bg-fg/[0.06] transition-colors"
                            title={t("editLog")}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteLogTarget(log)}
                            className="p-1.5 rounded-lg text-fg/60 hover:text-red-400 hover:bg-fg/[0.06] transition-colors"
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
              }
              cards={
                <div className="flex flex-col gap-2 p-2.5">
                  {maintenanceLoading && Array.from({ length: 4 }).map((_, i) => (
                    <div key={`msk-m-${i}`} className="animate-pulse bg-surface-2 border border-fg/[0.06] rounded-xl h-20" />
                  ))}
                  {!maintenanceLoading && groupedMaintenanceLogs.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-10 text-center text-fg/40">
                      <Wrench className="w-8 h-8" aria-hidden="true" />
                      <p className="text-sm">{t("recordsCount", { count: 0 })}</p>
                    </div>
                  )}
                  {!maintenanceLoading && groupedMaintenanceLogs.map(([category, logs]) => {
                    const isCatOpen = expandedMaintenanceCategories.has(category);
                    const inProgressCount = logs.filter((l: any) => l.status === "in_progress").length;
                    const categoryLabel = category === GENERAL_MAINTENANCE_CATEGORY ? t("generalLog") : category;
                    const catAllSelected = logs.length > 0 && logs.every((l: any) => selectedLogIds.has(l.id));
                    const catSomeSelected = !catAllSelected && logs.some((l: any) => selectedLogIds.has(l.id));
                    return (
                      <div key={`m-${category}`} className="rounded-xl border border-fg/10 bg-surface-1 overflow-hidden">
                        <button
                          onClick={() => toggleMaintenanceCategory(category)}
                          className="w-full text-left px-2.5 py-2.5 flex items-center gap-2 min-h-[46px] hover:bg-surface-2 transition-colors"
                        >
                          {canEdit && (
                            <div
                              role="checkbox"
                              aria-checked={catAllSelected}
                              onClick={(e) => { e.stopPropagation(); toggleCategorySelection(logs); }}
                              className={`tap-target w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all
                                ${catAllSelected ? "border-brand bg-brand" : catSomeSelected ? "border-brand/60 bg-brand/20" : "border-fg/20"}`}
                            >
                              {catAllSelected && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                              {catSomeSelected && <div className="w-1.5 h-0.5 bg-brand rounded-full" />}
                            </div>
                          )}
                          <ChevronRightIcon className={`w-3.5 h-3.5 flex-shrink-0 text-brand/60 transition-transform duration-200 ${isCatOpen ? "rotate-90" : ""}`} aria-hidden="true" />
                          <Wrench className="w-3.5 h-3.5 text-brand/40 flex-shrink-0" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[13px] text-brand truncate">{categoryLabel}</div>
                            <div className="text-[10px] text-fg/60 mt-0.5">{t("recordsCount", { count: logs.length })}</div>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                            inProgressCount > 0 ? "bg-amber-950/40 text-amber-500" : "bg-emerald-950/40 text-emerald-500"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${inProgressCount > 0 ? "bg-amber-500" : "bg-emerald-500"}`} />
                            {inProgressCount > 0 ? t("inProgressCount", { count: inProgressCount }) : t("allLogsCompleted")}
                          </span>
                        </button>

                        {isCatOpen && (
                          <div className="flex flex-col gap-1.5 px-2 pb-2">
                            {logs.map((log: any) => {
                              const isEditing = editingLogId === log.id;
                              const assetName = log.stockUnitId ? (unitLookup.get(log.stockUnitId) ?? log.stockUnitId) : t("generalLog");

                              if (isEditing) {
                                return (
                                  <div key={log.id} className="bg-surface-2 border border-brand/30 rounded-xl p-3.5 flex flex-col gap-2.5">
                                    <div className="font-semibold text-sm text-fg truncate">{assetName}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <div className="text-[10px] uppercase tracking-wide text-fg/40 mb-1">{t("colCost")}</div>
                                        <input
                                          type="number" step="0.01"
                                          className="h-9 w-full bg-black/50 border border-fg/10 rounded px-2 text-sm text-fg focus:outline-none focus:border-brand/40 transition-colors"
                                          value={logForm.cost}
                                          onChange={(e) => setLogForm((f) => ({ ...f, cost: e.target.value }))}
                                          placeholder={t("costPlaceholder")}
                                        />
                                      </div>
                                      <div>
                                        <div className="text-[10px] uppercase tracking-wide text-fg/40 mb-1">{tc("status")}</div>
                                        <select
                                          className="h-9 w-full bg-black/50 border border-fg/10 rounded px-2 text-sm text-fg focus:outline-none focus:border-brand/40 transition-colors appearance-none cursor-pointer"
                                          value={logForm.status}
                                          onChange={(e) => setLogForm((f) => ({ ...f, status: e.target.value }))}
                                        >
                                          <option value="in_progress" className="bg-surface-1">{tc("statusEnum.in_progress")}</option>
                                          <option value="completed" className="bg-surface-1">{tc("statusEnum.completed")}</option>
                                        </select>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 justify-end pt-1">
                                      <button
                                        onClick={() => setEditingLogId(null)}
                                        className="tap-target h-9 px-3 rounded-lg text-xs text-fg/60 hover:text-fg border border-fg/10 hover:border-fg/20 transition-colors"
                                      >
                                        {tc("cancel")}
                                      </button>
                                      <button
                                        onClick={() => saveEditLog(log.id)}
                                        disabled={updateMaintenanceLog.isPending}
                                        className="tap-target h-9 px-3 rounded-lg text-xs font-bold text-black flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-80"
                                        style={{ backgroundColor: "var(--brand)" }}
                                      >
                                        {updateMaintenanceLog.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                        {tc("save")}
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <DataCard
                                  key={log.id}
                                  data-testid={`maintenance-${log.id}`}
                                  title={
                                    <div className="flex items-center gap-2">
                                      {canEdit && (
                                        <div
                                          role="checkbox"
                                          aria-checked={selectedLogIds.has(log.id)}
                                          onClick={(e) => { e.stopPropagation(); toggleLogSelection(log.id); }}
                                          className={`tap-target w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-all
                                            ${selectedLogIds.has(log.id) ? "border-brand bg-brand" : "border-fg/20"}`}
                                        >
                                          {selectedLogIds.has(log.id) && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                                        </div>
                                      )}
                                      <span className="truncate">{assetName}</span>
                                    </div>
                                  }
                                  subtitle={new Date(log.date).toLocaleDateString("en-GB")}
                                  badge={
                                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${log.status === "completed" ? "text-emerald-400" : "text-amber-400"}`}>
                                      {log.status === "completed" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                      {tc(`statusEnum.${log.status}`, { defaultValue: log.status })}
                                    </span>
                                  }
                                  fields={[
                                    {
                                      label: t("colType"),
                                      value: (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                          log.type === "repair" ? "bg-red-500/10 text-red-400" : log.type === "preventive" ? "bg-blue-500/10 text-blue-400" : "bg-fg/5 text-fg/60"
                                        }`}>{tc(`statusEnum.${log.type}`, { defaultValue: log.type })}</span>
                                      ),
                                    },
                                    { label: t("colTech"), value: log.techId ? (crewLookup.get(log.techId) ?? "—") : "—" },
                                    {
                                      label: t("colCost"),
                                      value: (
                                        <span className="inline-flex items-center gap-1.5">
                                          {log.cost ? `£${log.cost}` : "—"}
                                          {log.receiptUrl && (
                                            <a href={log.receiptUrl} target="_blank" rel="noopener noreferrer" title="View receipt"
                                              onClick={(e) => e.stopPropagation()}
                                              className="text-fg/60 hover:text-brand transition-colors">
                                              <Receipt className="w-3 h-3" />
                                            </a>
                                          )}
                                        </span>
                                      ),
                                    },
                                    { label: tc("description"), value: log.description || "—", full: true },
                                  ]}
                                  actions={canEdit ? (
                                    <>
                                      <button
                                        onClick={() => startEditLog(log)}
                                        className="tap-target flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-semibold bg-fg/[0.06] text-fg/70 hover:bg-fg/10 transition-colors"
                                      >
                                        <Pencil className="w-3 h-3" /> {tc("edit")}
                                      </button>
                                      <button
                                        onClick={() => setDeleteLogTarget(log)}
                                        className="tap-target flex items-center gap-1 h-8 px-2.5 rounded-lg text-[11px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                      >
                                        <Trash2 className="w-3 h-3" /> {tc("delete")}
                                      </button>
                                    </>
                                  ) : undefined}
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              }
            />
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
                  className="bg-red-600 hover:bg-red-700 text-fg"
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
                  className="bg-red-600 hover:bg-red-700 text-fg"
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
          <div className="h-scroll flex flex-row items-center gap-2 md:gap-3 w-full px-3 md:px-4 py-2.5 md:py-3 border-b border-fg/[0.06] bg-surface-1 flex-shrink-0 animate-fade-in [&>*]:flex-shrink-0">
            <ArrowRightLeft className="w-4 h-4 text-purple-400/70 flex-shrink-0" />
            <span className="text-sm font-semibold text-fg/50">{t("tabSubRentals")}</span>
            <span className="text-xs text-fg/60">{t("activeCount", { count: subRentals.length })}</span>
            <span className="flex items-center gap-1.5 text-xs text-purple-400/50 ml-2">
              <Shield className="w-3 h-3" />
              {t("colorCodedNote")}
            </span>
            <span className="ml-auto text-[11px] text-fg/40 italic">{t("subRentalsManageHint")}</span>
          </div>

          <div className="flex-1 overflow-auto p-2.5 pb-24 md:p-6">
          <div className="bg-surface-1 border border-purple-500/15 rounded-xl overflow-hidden">
            <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-purple-500/10 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-purple-400 text-xs tracking-widest uppercase">{t("tabSubRentals")}</span>
              <span className="text-[10px] text-fg/60">{t("activeCount", { count: subRentals.length })}</span>
            </div>
            <div className="divide-y divide-fg/[0.04]">
              {subRentalsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={`srsk-${i}`} className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-2.5 md:py-3 animate-pulse">
                    <div className="w-1 h-8 rounded-full bg-purple-400/20" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-3.5 rounded bg-fg/[0.06]" style={{ width: `${80 + (i * 29) % 60}px` }} />
                        <div className="h-4 rounded bg-purple-500/15 w-12" />
                      </div>
                      <div className="h-2.5 rounded bg-fg/[0.04] w-40" />
                    </div>
                    <div className="text-right space-y-1.5">
                      <div className="h-3 rounded bg-fg/[0.05] w-16 ml-auto" />
                      <div className="h-2.5 rounded bg-fg/[0.04] w-20 ml-auto" />
                    </div>
                  </div>
                ))
              ) : subRentals.map((sr) => (
                <div key={sr.id} className="flex flex-wrap items-center gap-2.5 md:gap-4 px-3 md:px-4 py-2.5 md:py-3 hover:bg-purple-500/[0.03] transition-colors" data-testid={`subrental-${sr.id}`}>
                  <div className="hidden md:block w-1 h-8 rounded-full bg-purple-400/60" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] md:text-sm font-medium text-fg/80">{sr.itemName}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${sr.status === "active" ? "bg-purple-500/15 text-purple-400" : sr.status === "returned" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>{tc(`statusEnum.${sr.status}`, { defaultValue: sr.status })}</span>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-[11px] text-fg/60 mt-0.5 flex-wrap">
                      <span>{t("fromPartner", { partner: sr.partner })}</span>
                      <span className="text-blue-400/60">→ {sr.jobName}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-fg/50 font-medium inline-flex items-center gap-1.5 justify-end">
                      {sr.dailyRate ? `฿${Number(sr.dailyRate).toLocaleString()}/day` : "—"}
                      {sr.receiptUrl && (
                        <a href={sr.receiptUrl} target="_blank" rel="noopener noreferrer" title="View receipt"
                          className="text-fg/60 hover:text-purple-300 transition-colors">
                          <Receipt className="w-3 h-3" />
                        </a>
                      )}
                    </p>
                    <p className="text-[10px] text-fg/60 flex items-center gap-1 justify-end"><Clock className="w-3 h-3" />{t("dueLabel", { date: new Date(sr.dueBack).toLocaleDateString("en-GB") })}</p>
                  </div>
                  {canEdit && sr.status !== "returned" && (
                    <button
                      onClick={() => returnSubRental.mutate(sr.id)}
                      disabled={returnSubRental.isPending && returnSubRental.variables === sr.id}
                      className="flex items-center gap-1 h-7 px-2.5 rounded-md text-[10px] font-semibold text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors flex-shrink-0 disabled:opacity-40"
                    >
                      {returnSubRental.isPending && returnSubRental.variables === sr.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Check className="w-3 h-3" />}
                      {t("markReturned")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          </div>
        </div>
      )}

      {activeTab === "disposals" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Action bar */}
          <div className="h-scroll flex flex-row items-center gap-2 md:gap-3 w-full px-3 md:px-4 py-2.5 md:py-3 border-b border-fg/[0.06] bg-surface-1 flex-shrink-0 animate-fade-in [&>*]:flex-shrink-0">
            <PackageMinus className="w-4 h-4 text-red-400/70 flex-shrink-0" />
            <span className="text-sm font-semibold text-fg/50">{t("tabDisposals")}</span>
            <span className="text-xs text-fg/60">{disposals.length}</span>
            {canEdit && (
              <button onClick={() => setDisposeOpen(true)}
                className="ml-auto flex items-center gap-2 h-11 md:h-9 px-4 rounded-xl md:rounded-lg text-sm font-bold text-fg bg-red-600 hover:bg-red-700 transition-colors">
                <PackageMinus className="w-4 h-4" /> ขาย / ตัดออก
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto p-2 pb-24 md:p-4">
            {disposals.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-fg/40">
                <PackageMinus className="w-10 h-10" aria-hidden="true" />
                <p className="text-sm">ยังไม่มีประวัติการขาย/ตัดออก</p>
              </div>
            ) : (
              <ResponsiveTable
                cards={
                  <div className="flex flex-col gap-2">
                    {disposals.map((d) => (
                      <DataCard
                        key={`m-${d.id}`}
                        title={d.itemName}
                        subtitle={new Date(d.disposedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                        badge={
                          <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${d.reason === "sold" ? "bg-emerald-500/15 text-emerald-400" : d.reason === "damaged" ? "bg-amber-500/15 text-amber-400" : d.reason === "lost" ? "bg-red-500/15 text-red-400" : "bg-fg/10 text-fg/50"}`}>
                            {REASON_LABEL[d.reason]}
                          </span>
                        }
                        fields={[
                          { label: "จำนวน", value: d.quantity },
                          { label: "ราคาขาย", value: d.salePrice ? `฿${Number(d.salePrice).toLocaleString()}` : "—" },
                          { label: "โดย", value: d.disposedByName ?? "—" },
                          { label: "หมายเหตุ", value: d.note ?? "—", full: true },
                        ]}
                      />
                    ))}
                  </div>
                }
                table={
              <div className="bg-surface-1 border border-fg/[0.06] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-fg/[0.06] text-[10px] text-fg/40 uppercase tracking-wider">
                      <th className="py-2.5 pl-4 text-left font-semibold">วันที่</th>
                      <th className="py-2.5 text-left font-semibold">อุปกรณ์</th>
                      <th className="py-2.5 text-center font-semibold">จำนวน</th>
                      <th className="py-2.5 text-left font-semibold">เหตุผล</th>
                      <th className="py-2.5 text-right font-semibold">ราคาขาย</th>
                      <th className="py-2.5 text-left font-semibold">โดย</th>
                      <th className="py-2.5 pr-4 text-left font-semibold">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disposals.map((d) => (
                      <tr key={d.id} className="border-b border-fg/[0.04] hover:bg-fg/[0.02]">
                        <td className="py-2.5 pl-4 text-fg/60 text-xs whitespace-nowrap">{new Date(d.disposedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</td>
                        <td className="py-2.5 text-fg/85">{d.itemName}</td>
                        <td className="py-2.5 text-center font-bold text-fg/80">{d.quantity}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${d.reason === "sold" ? "bg-emerald-500/15 text-emerald-400" : d.reason === "damaged" ? "bg-amber-500/15 text-amber-400" : d.reason === "lost" ? "bg-red-500/15 text-red-400" : "bg-fg/10 text-fg/50"}`}>{REASON_LABEL[d.reason]}</span>
                        </td>
                        <td className="py-2.5 text-right text-fg/70 whitespace-nowrap">{d.salePrice ? `฿${Number(d.salePrice).toLocaleString()}` : "—"}</td>
                        <td className="py-2.5 text-fg/50 text-xs">{d.disposedByName ?? "—"}</td>
                        <td className="py-2.5 pr-4 text-fg/50 text-xs truncate max-w-[200px]">{d.note ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                }
              />
            )}
          </div>
        </div>
      )}
      </div>

      {/* Mobile-only fixed bottom tab bar — replaces the top ScrollTabs on phones so
          the tabs sit within thumb reach. Pairs with the swipe handlers above (same
          activeTab/setActiveTab, wraps at the ends via goToAdjacentTab). */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-1 border-t border-fg/[0.06] safe-b">
        <div className="grid grid-cols-6">
          {stockTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={`tap-target flex flex-col items-center justify-center gap-1 min-h-[58px] py-1.5 px-0.5 transition-colors ${
                  isActive ? "text-brand" : "text-fg/50"
                }`}
                data-testid={`bottomtab-stock-${tab.key}`}
              >
                <Icon className="w-7 h-7 flex-shrink-0" aria-hidden="true" />
                <span className="text-[9px] font-semibold leading-none truncate max-w-full">{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
