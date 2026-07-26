import { useMemo, useState } from "react";
import { X, Link2, Plus, Minus, Check, Trash2, Search, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { stockApi } from "@/api";
import type { ItemAccessoryWithInfo } from "@/api";
import type { InsertItemAccessory, StockItem } from "@shared/schema";

interface Props {
  item:    StockItem;
  onClose: () => void;
}

// จัดการอุปกรณ์เสริมของรุ่นนี้ (เช่น flying frame / load beam ที่ต้องไปกับลำโพง) — เปิดตรงจากปุ่ม 🔗
// บนแถวในตาราง Inventory แทนที่จะต้องเปิด ItemDetailPanel แล้วไปกดแท็บ (ย้ายออกมาเป็น modal อิสระแล้ว)
export const AccessoriesModal = ({ item, onClose }: Props): JSX.Element => {
  const { t } = useTranslation("stock");
  const { token, userRole } = useAppStore();
  const qc = useQueryClient();
  const canManage = userRole === "admin" || userRole === "manager";

  const [accSearch, setAccSearch] = useState("");
  const [accSelected, setAccSelected] = useState<Set<string>>(new Set());
  const [addingBulkAcc, setAddingBulkAcc] = useState(false);

  const { data: accessories = [], isLoading: accLoading } = useQuery<ItemAccessoryWithInfo[]>({
    queryKey: ["accessories", item.id],
    queryFn:  () => stockApi.getAccessories(item.id),
    enabled:  !!token,
  });

  const { data: allItems = [] } = useQuery<StockItem[]>({
    queryKey: ["stock"],
    queryFn:  stockApi.getAll,
    enabled:  !!token && canManage,
  });

  const accSearchResults = useMemo(() => {
    if (!accSearch.trim()) return [];
    const q = accSearch.toLowerCase();
    const linkedIds = new Set(accessories.map((a) => a.accessoryStockItemId));
    return allItems
      .filter((si) => si.id !== item.id && !linkedIds.has(si.id) && si.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [accSearch, allItems, accessories, item.id]);

  const addAcc = useMutation({
    mutationFn: (d: { accessoryStockItemId: string; quantityPerUnit: number; required: boolean }) =>
      stockApi.addAccessory(item.id, d),
  });

  const removeAcc = useMutation({
    mutationFn: (linkId: string) => stockApi.removeAccessory(linkId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accessories", item.id] }),
  });

  const updateAcc = useMutation({
    mutationFn: (v: { linkId: string; data: Partial<Pick<InsertItemAccessory, "quantityPerUnit" | "required">> }) =>
      stockApi.updateAccessory(v.linkId, v.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accessories", item.id] }),
  });

  const toggleAccSelected = (id: string) => setAccSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleAddSelectedAcc = async () => {
    if (accSelected.size === 0) return;
    setAddingBulkAcc(true);
    try {
      for (const id of Array.from(accSelected)) {
        await addAcc.mutateAsync({ accessoryStockItemId: id, quantityPerUnit: 1, required: true });
      }
      qc.invalidateQueries({ queryKey: ["accessories", item.id] });
      setAccSearch("");
      setAccSelected(new Set());
    } finally {
      setAddingBulkAcc(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col bg-[#0d0d0d] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-modal-up">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFFF00" }}>
              <Link2 className="w-4 h-4 text-black" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm truncate">{t("tabAccessories")}</h3>
              <p className="text-[11px] text-white/50 truncate">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">

          {/* Search box — top */}
          {canManage && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/40" />
                <input
                  value={accSearch}
                  onChange={(e) => setAccSearch(e.target.value)}
                  placeholder={t("searchAccessoryPlaceholder")}
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FFFF00]/40"
                />
              </div>
              {accSearchResults.map((si) => {
                const checked = accSelected.has(si.id);
                return (
                  <div
                    key={si.id}
                    onClick={() => toggleAccSelected(si.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${checked ? "bg-[#FFFF00]/[0.08] border-[#FFFF00]/30" : "bg-white/[0.03] border-white/[0.06] hover:border-white/15"}`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${checked ? "bg-[#FFFF00] border-[#FFFF00]" : "border-white/20"}`}>
                      {checked && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                    </div>
                    <p className="text-xs text-white/70 flex-1 truncate">{si.name}</p>
                  </div>
                );
              })}
              {accSelected.size > 0 && (
                <button
                  onClick={handleAddSelectedAcc}
                  disabled={addingBulkAcc}
                  className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-bold text-black disabled:opacity-40 transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "#FFFF00" }}
                >
                  {addingBulkAcc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {t("addSelectedAccessories", { count: accSelected.size })}
                </button>
              )}
            </div>
          )}

          <p className="text-[10px] text-white/50 leading-relaxed">{t("accessoriesHint")}</p>

          {accLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-white/60">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : accessories.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2 text-white/40">
              <Link2 className="w-6 h-6" />
              <p className="text-xs">{t("noAccessoriesYet")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accessories.map((acc) => (
                <div key={acc.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/80 truncate">{acc.accessoryName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {canManage ? (
                        <div className="flex items-center gap-0.5 bg-black/30 rounded-md border border-white/10">
                          <button
                            onClick={() => updateAcc.mutate({ linkId: acc.id, data: { quantityPerUnit: Math.max(1, acc.quantityPerUnit - 1) } })}
                            className="w-5 h-5 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="text-[10px] text-white/70 w-4 text-center tabular-nums">×{acc.quantityPerUnit}</span>
                          <button
                            onClick={() => updateAcc.mutate({ linkId: acc.id, data: { quantityPerUnit: acc.quantityPerUnit + 1 } })}
                            className="w-5 h-5 flex items-center justify-center text-white/50 hover:text-white transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-white/50">×{acc.quantityPerUnit}</span>
                      )}
                      {canManage ? (
                        <button
                          onClick={() => updateAcc.mutate({ linkId: acc.id, data: { required: !acc.required } })}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-colors ${acc.required ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-white/10 text-white/50 hover:bg-white/15"}`}
                        >
                          {acc.required ? t("requiredLabel") : t("optionalLabel")}
                        </button>
                      ) : (
                        <span className={`text-[9px] px-1 rounded font-bold ${acc.required ? "bg-amber-500/20 text-amber-400" : "bg-white/10 text-white/50"}`}>
                          {acc.required ? t("requiredLabel") : t("optionalLabel")}
                        </span>
                      )}
                      <span className="text-[10px] text-emerald-400/70">{acc.availableCount} {t("availableCountLabel")}</span>
                    </div>
                  </div>
                  {canManage && (
                    <button onClick={() => removeAcc.mutate(acc.id)}
                      disabled={removeAcc.isPending}
                      className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
