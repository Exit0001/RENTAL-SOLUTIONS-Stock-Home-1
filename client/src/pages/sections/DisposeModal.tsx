import { useState, useMemo } from "react";
import { X, PackageMinus, Search, Loader2, Check, Layers } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { stockApi, disposalsApi } from "@/api";
import type { StockItemWithUnits, DisposalReason } from "@/api";

interface Props { onClose: () => void; }

export const REASON_LABEL: Record<DisposalReason, string> = {
  sold: "ขายแล้ว", damaged: "ชำรุด", lost: "สูญหาย", other: "อื่นๆ",
};
const REASONS: DisposalReason[] = ["sold", "damaged", "lost", "other"];

export const DisposeModal = ({ onClose }: Props): JSX.Element => {
  const { token } = useAppStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [item, setItem] = useState<StockItemWithUnits | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<DisposalReason>("sold");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<StockItemWithUnits[]>({
    queryKey: ["stock-with-units"], queryFn: stockApi.getAllWithUnits, enabled: !!token,
  });

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => !q ? items : items.filter((i) =>
    i.name.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) ||
    i.units.some((u) => (u.serialNumber ?? "").toLowerCase().includes(q))), [items, q]);

  const isBulk = item?.trackingMode === "bulk";
  const availUnits = useMemo(() => item ? item.units.filter((u) => u.status === "available") : [], [item]);
  const maxBulk = item ? (item.availableCount ?? item.quantity ?? 0) : 0;

  const selectItem = (it: StockItemWithUnits) => {
    setItem(it); setSelectedUnits(new Set()); setQty(1); setError(null);
  };

  const disposeMutation = useMutation({
    mutationFn: () => disposalsApi.create({
      stockItemId: item!.id,
      stockUnitIds: isBulk ? undefined : Array.from(selectedUnits),
      quantity: isBulk ? qty : undefined,
      reason, salePrice: price.trim() || null, note: note.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["stock-with-units"] });
      qc.invalidateQueries({ queryKey: ["disposals"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["containers"] });
      onClose();
    },
    onError: (e: any) => setError(e?.message ?? "ทำรายการไม่สำเร็จ"),
  });

  const canSubmit = item && (isBulk ? qty > 0 && qty <= maxBulk : selectedUnits.size > 0);
  const count = isBulk ? qty : selectedUnits.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-surface-1 border border-fg/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-fg/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"><PackageMinus className="w-4 h-4 text-red-400" /></div>
            <h2 className="font-bold text-fg text-sm">ขาย / ตัดของออกจากสต็อก</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-fg/60 hover:text-fg hover:bg-fg/[0.06] transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 1. pick item */}
          {!item ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg/60" />
                <input autoFocus placeholder="ค้นหาอุปกรณ์ / serial…" value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-fg/[0.04] border border-fg/10 text-sm text-fg placeholder-fg/20 focus:outline-none focus:border-brand/40" />
              </div>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-fg/40" /></div>
                  : filtered.slice(0, 60).map((it) => {
                    const bulk = it.trackingMode === "bulk";
                    const avail = bulk ? (it.availableCount ?? it.quantity ?? 0) : it.units.filter((u) => u.status === "available").length;
                    return (
                      <button key={it.id} onClick={() => selectItem(it)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-fg/[0.06] bg-fg/[0.02] hover:border-brand/30 hover:bg-fg/[0.04] text-left transition-colors">
                        {bulk && <Layers className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />}
                        <div className="flex-1 min-w-0"><p className="text-sm text-fg/85 truncate">{it.name}</p><p className="text-[10px] text-fg/40">{it.brand} · {it.category}</p></div>
                        <span className="text-[11px] text-fg/50 flex-shrink-0">ว่าง {avail}{bulk ? " (นับจำนวน)" : ""}</span>
                      </button>
                    );
                  })}
                {!isLoading && filtered.length === 0 && <p className="text-center text-xs text-fg/40 py-8">ไม่พบอุปกรณ์</p>}
              </div>
            </>
          ) : (
            <>
              {/* selected item header */}
              <div className="flex items-center gap-2">
                <button onClick={() => setItem(null)} className="text-[11px] text-fg/50 hover:text-fg">← เปลี่ยน</button>
                <span className="text-sm font-bold text-fg truncate">{item.name}</span>
                {isBulk && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 font-bold">นับจำนวน</span>}
              </div>

              {/* qty (bulk) or unit picker (unit) */}
              {isBulk ? (
                <div>
                  <label className="block text-[11px] font-bold text-fg/70 mb-1">จำนวนที่ตัดออก (มี {maxBulk})</label>
                  <input type="number" min={1} max={maxBulk} value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(maxBulk, Number(e.target.value) || 1)))}
                    className="w-full h-9 px-3 rounded-lg bg-fg/[0.04] border border-fg/10 text-sm text-fg focus:outline-none focus:border-brand/50" />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-fg/70 mb-1">เลือก unit ที่ตัดออก ({selectedUnits.size}/{availUnits.length})</label>
                  <div className="space-y-1 max-h-52 overflow-y-auto">
                    {availUnits.length === 0 ? <p className="text-xs text-fg/40 py-2">ไม่มี unit ว่าง</p> : availUnits.map((u) => {
                      const on = selectedUnits.has(u.id);
                      return (
                        <button key={u.id} onClick={() => setSelectedUnits((prev) => { const n = new Set(prev); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n; })}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-colors ${on ? "bg-red-500/[0.08] border border-red-500/25" : "border border-fg/[0.06] hover:bg-fg/[0.03]"}`}>
                          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${on ? "bg-red-500" : "border border-fg/20"}`}>{on && <Check className="w-2.5 h-2.5 text-fg" strokeWidth={3} />}</div>
                          <span className="text-xs text-fg/85 truncate flex-1">{u.name}</span>
                          {u.serialNumber && <span className="text-[10px] text-fg/40 font-mono">{u.serialNumber}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* reason */}
              <div>
                <label className="block text-[11px] font-bold text-fg/70 mb-1.5">เหตุผล</label>
                <div className="flex flex-wrap gap-1.5">
                  {REASONS.map((r) => (
                    <button key={r} onClick={() => setReason(r)}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${reason === r ? "bg-red-500 text-fg border-red-500" : "text-fg/60 border-fg/10 hover:border-fg/30"}`}>{REASON_LABEL[r]}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-fg/70 mb-1">ราคาขายรวม (บาท)</label>
                  <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0"
                    className="w-full h-9 px-3 rounded-lg bg-fg/[0.04] border border-fg/10 text-sm text-fg placeholder:text-fg/30 focus:outline-none focus:border-brand/50" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-fg/70 mb-1">หมายเหตุ</label>
                  <input value={note} onChange={(e) => setNote(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg bg-fg/[0.04] border border-fg/10 text-sm text-fg focus:outline-none focus:border-brand/50" />
                </div>
              </div>
            </>
          )}
        </div>

        {error && <div className="mx-5 mb-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 flex-shrink-0">{error}</div>}

        {item && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-fg/[0.06] flex-shrink-0 gap-3">
            <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm text-fg/60 hover:text-fg hover:bg-fg/[0.06] transition-colors">ยกเลิก</button>
            <button onClick={() => { setError(null); disposeMutation.mutate(); }} disabled={!canSubmit || disposeMutation.isPending}
              className="flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-bold text-fg bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40">
              {disposeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageMinus className="w-3.5 h-3.5" />}
              ตัดออก {count > 0 ? `(${count})` : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
