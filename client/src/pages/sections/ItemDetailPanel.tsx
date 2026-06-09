import React, { useState } from "react";
import {
  X, Package, Pencil, MapPin, Hash, Barcode, Archive,
  Boxes, Info, DollarSign, Wrench, FileText, Loader2,
  ExternalLink, ShieldCheck, Calendar,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { stockApi } from "@/api";
import type { StockItem, StockUnit } from "@shared/schema";

// ────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────

const nil = (v: any) => v === null || v === undefined || v === "";

const Val = ({ value, mono = false }: { value: any; mono?: boolean }) =>
  nil(value) ? (
    <span className="text-white/30 italic text-[10px]">ยังไม่ได้กรอก</span>
  ) : (
    <span className={`text-white/70 text-xs ${mono ? "font-mono" : ""}`}>{String(value)}</span>
  );

const Row = ({ label, value, mono }: { label: string; value: any; mono?: boolean }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
    <span className="text-[10px] text-white/30 flex-shrink-0 min-w-[90px]">{label}</span>
    <Val value={value} mono={mono} />
  </div>
);

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <div className="px-4 pt-3 pb-1">
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3 h-3 text-[#FFFF00]/40" />
      <span className="text-[9px] font-bold text-[#FFFF00]/40 uppercase tracking-widest">{title}</span>
    </div>
    {children}
  </div>
);

const unitStatusColor: Record<string, { bg: string; text: string; dot: string }> = {
  available:   { bg: "bg-emerald-950/60", text: "text-emerald-400", dot: "bg-emerald-400" },
  out:         { bg: "bg-blue-950/60",    text: "text-blue-400",    dot: "bg-blue-400" },
  maintenance: { bg: "bg-amber-950/60",   text: "text-amber-400",   dot: "bg-amber-400" },
  retired:     { bg: "bg-white/5",        text: "text-white/30",    dot: "bg-white/20" },
};

const STATUS_CYCLE: Record<string, "available" | "out" | "maintenance" | "retired"> = {
  available:   "maintenance",
  maintenance: "available",
  out:         "available",
  retired:     "available",
};

// ────────────────────────────────────────────────
// main component
// ────────────────────────────────────────────────

interface Props {
  item:    StockItem & { unitCount?: number };
  onClose: () => void;
  onEdit:  () => void;
}

export const ItemDetailPanel = ({ item, onClose, onEdit }: Props): JSX.Element => {
  const { token } = useAppStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"units" | "details">("units");

  // Fetch full item with units
  const { data, isLoading } = useQuery({
    queryKey: ["stock", item.id],
    queryFn:  () => stockApi.getById(item.id),
    enabled: !!token,
  });

  const units: StockUnit[] = (data as any)?.units ?? [];

  const updateUnit = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      stockApi.updateUnit(id, { status: status as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock", item.id] }),
  });

  const availableCount   = units.filter((u) => u.status === "available").length;
  const outCount         = units.filter((u) => u.status === "out").length;
  const maintenanceCount = units.filter((u) => u.status === "maintenance").length;

  const fmtDate = (v: any) => {
    if (nil(v)) return null;
    return new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const fmtCost = (v: any) => {
    if (nil(v)) return null;
    return `฿${Number(v).toLocaleString()}`;
  };

  return (
    <div className="flex flex-col h-full w-80 flex-shrink-0 bg-[#0d0d0d] border-l border-white/[0.06] overflow-hidden animate-slide-in-right">

      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFFF00" }}>
              <Package className="w-3.5 h-3.5 text-black" />
            </div>
            <h3 className="font-bold text-white text-sm truncate">{item.name}</h3>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/40">{item.brand}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/40">{item.category}</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/40">{item.subCategory}</span>
          </div>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-white hover:bg-white/[0.06] transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-px bg-white/[0.04] flex-shrink-0">
        <div className="bg-[#0d0d0d] px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-white">{units.length}</span>
          <span className="text-[8px] text-white/25 uppercase tracking-wider">Total</span>
        </div>
        <div className="bg-[#0d0d0d] px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-emerald-400">{availableCount}</span>
          <span className="text-[8px] text-white/25 uppercase tracking-wider">Ready</span>
        </div>
        <div className="bg-[#0d0d0d] px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-blue-400">{outCount}</span>
          <span className="text-[8px] text-white/25 uppercase tracking-wider">Out</span>
        </div>
        <div className="bg-[#0d0d0d] px-2 py-2.5 flex flex-col items-center">
          <span className="text-base font-bold text-amber-400">{maintenanceCount}</span>
          <span className="text-[8px] text-white/25 uppercase tracking-wider">Repair</span>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0">
        {[
          { key: "units",   label: "Units",   icon: Boxes },
          { key: "details", label: "Details", icon: Info },
        ].map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === t.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/25 hover:text-white/50"
            }`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Units tab ── */}
        {activeTab === "units" && (
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-white/25">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Loading units...</span>
              </div>
            ) : units.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/15 gap-2">
                <Package className="w-8 h-8" />
                <p className="text-sm">ยังไม่มี units</p>
                <p className="text-[10px] text-center px-6">ใช้ "Add Individual Unit" เพื่อเพิ่มอุปกรณ์แต่ละชิ้น</p>
              </div>
            ) : (
              units.map((u, i) => {
                const sc = unitStatusColor[u.status] ?? unitStatusColor.available;
                return (
                  <div key={u.id}
                    className="flex flex-col gap-1.5 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    style={{ animationDelay: `${i * 30}ms` }}>

                    {/* Name + status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-white/85 font-medium truncate">{u.name}</span>
                      <button
                        onClick={() => updateUnit.mutate({ id: u.id, status: STATUS_CYCLE[u.status] ?? "available" })}
                        title="กดเพื่อเปลี่ยน status"
                        disabled={updateUnit.isPending}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-current/20
                          transition-opacity hover:opacity-70 flex-shrink-0 ${sc.bg} ${sc.text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {u.status.toUpperCase()}
                      </button>
                    </div>

                    {/* Serial + Barcode */}
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Hash className="w-2.5 h-2.5 flex-shrink-0" />
                        {nil(u.serialNumber)
                          ? <span className="italic text-white/30">ยังไม่ได้กรอก</span>
                          : <span className="font-mono text-white/60">{u.serialNumber}</span>
                        }
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Barcode className="w-2.5 h-2.5 flex-shrink-0" />
                        {nil(u.barcode)
                          ? <span className="italic text-white/30">ยังไม่ได้กรอก</span>
                          : <span className="font-mono text-white/60">{u.barcode}</span>
                        }
                      </span>
                    </div>

                    {/* Location + Health */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                        {nil(u.location)
                          ? <span className="italic text-white/30">ยังไม่ได้กรอก</span>
                          : <span className="text-white/55">{u.location}</span>
                        }
                      </span>
                      {u.healthScore != null && (
                        <span className={`text-[10px] font-semibold ${
                          u.healthScore >= 80 ? "text-emerald-400/70" :
                          u.healthScore >= 50 ? "text-amber-400/70" : "text-red-400/70"
                        }`}>
                          {u.healthScore}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {!isLoading && units.length > 0 && (
              <p className="text-[9px] text-white/15 text-center py-2">กดที่ status badge เพื่อเปลี่ยน</p>
            )}
          </div>
        )}

        {/* ── Details tab ── */}
        {activeTab === "details" && (
          <div className="pb-4">

            <Section title="ทั่วไป" icon={Info}>
              <Row label="ผู้ผลิต"      value={item.manufacturer} />
              <Row label="ประเทศ"        value={item.manufacturerCountry} />
              <Row label="คำอธิบาย"      value={item.description} />
              <Row label="เพิ่มเมื่อ"    value={fmtDate(item.createdAt)} />
            </Section>

            <div className="border-t border-white/[0.04]" />

            <Section title="ราคา / ค่าเช่า" icon={DollarSign}>
              <Row label="ราคาซื้อ"       value={fmtCost(item.purchaseCost)} />
              <Row label="วันที่ซื้อ"      value={fmtDate(item.purchaseDate)} />
              <Row label="Daily rate"      value={item.dailyRate ? `฿${Number(item.dailyRate).toLocaleString()}` : null} />
              <Row label="Weekly rate"     value={item.weeklyRate ? `฿${Number(item.weeklyRate).toLocaleString()}` : null} />
              <Row label="มูลค่าทดแทน"    value={fmtCost(item.replacementValue)} />
              <Row label="มัดจำ"           value={fmtCost(item.securityDeposit)} />
            </Section>

            <div className="border-t border-white/[0.04]" />

            <Section title="ข้อมูลจำเพาะ" icon={Wrench}>
              <Row label="น้ำหนัก (kg)"   value={item.weight ? `${item.weight} kg` : null} />
              <Row label="ขนาด"            value={item.dimensions} />
              {item.specs?.fields && Object.entries(item.specs.fields).map(([k, v]) => (
                <Row key={k} label={k} value={v} />
              ))}
              {item.specs?.customFields?.map((f) => (
                <Row key={f.key} label={f.label} value={f.value} />
              ))}
            </Section>

            <div className="border-t border-white/[0.04]" />

            <Section title="เอกสาร / ผู้จัดจำหน่าย" icon={FileText}>
              <Row label="ผู้จัดจำหน่าย"  value={item.supplierName} />
              <Row label="ติดต่อ"          value={item.supportContact} />
              <Row label="ประกันหมดอายุ"   value={fmtDate(item.warrantyExpiry)} />

              {/* Document links */}
              {[
                { label: "คู่มือ",     url: item.manualUrl },
                { label: "ใบรับรอง",   url: item.certUrl },
                { label: "ใบเสร็จ",    url: item.invoiceUrl },
              ].map(({ label, url }) => (
                <div key={label} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.04] last:border-0">
                  <span className="text-[10px] text-white/30 min-w-[90px]">{label}</span>
                  {nil(url)
                    ? <span className="text-white/18 italic text-[10px]">ยังไม่ได้กรอก</span>
                    : <a href={url!} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] text-[#FFFF00]/60 hover:text-[#FFFF00] transition-colors">
                        เปิดไฟล์ <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                  }
                </div>
              ))}
            </Section>

          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-4 py-3 border-t border-white/[0.06] flex-shrink-0">
        <button onClick={onEdit}
          className="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 text-black transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#FFFF00" }}>
          <Pencil className="w-3.5 h-3.5" /> Edit Item
        </button>
        <button
          className="h-8 px-3 rounded-lg text-xs font-medium text-white/30 border border-white/10 hover:text-white hover:border-white/20 flex items-center gap-1.5 transition-colors">
          <Archive className="w-3.5 h-3.5" /> Archive
        </button>
      </div>
    </div>
  );
};
