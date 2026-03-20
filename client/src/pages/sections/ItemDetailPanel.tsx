import React, { useState } from "react";
import {
  X, Package, Pencil, MapPin, Hash, Barcode, ChevronRight,
  CheckCircle2, Wrench, AlertTriangle, Archive, History, Boxes,
} from "lucide-react";

interface SubItem {
  id: number;
  name: string;
  serialNumber: string;
  barcodeNumber: string;
  location: string;
  status: string;
}

interface StockItem {
  id: number;
  name: string;
  brand: string;
  category: string;
  subCategory: string;
  quantity: number;
  subItems: SubItem[];
}

const STATUS_CYCLE: Record<string, string> = {
  Available: "Maintenance",
  Maintenance: "Available",
  "On Job": "Available",
};

const StatusPill = ({
  status,
  onClick,
}: {
  status: string;
  onClick: () => void;
}) => {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    Available: { bg: "bg-emerald-950/60", text: "text-emerald-400", dot: "bg-emerald-400" },
    Maintenance: { bg: "bg-red-950/60", text: "text-red-400", dot: "bg-red-400" },
    "On Job": { bg: "bg-blue-950/60", text: "text-blue-400", dot: "bg-blue-400" },
  };
  const s = map[status] ?? map.Available;
  return (
    <button
      onClick={onClick}
      title="Click to change status"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-current/20 transition-opacity hover:opacity-70 cursor-pointer ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </button>
  );
};

interface ItemDetailPanelProps {
  item: StockItem;
  onClose: () => void;
  onEdit: () => void;
}

export const ItemDetailPanel = ({ item, onClose, onEdit }: ItemDetailPanelProps): JSX.Element => {
  const [units, setUnits] = useState<SubItem[]>(item.subItems);
  const [activeSection, setActiveSection] = useState<"units" | "history">("units");

  const cycleStatus = (id: number) => {
    setUnits((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: STATUS_CYCLE[u.status] ?? "Available" } : u
      )
    );
  };

  const availableCount = units.filter((u) => u.status === "Available").length;
  const maintenanceCount = units.filter((u) => u.status === "Maintenance").length;
  const onJobCount = units.filter((u) => u.status === "On Job").length;

  const mockHistory = [
    { date: "15 Mar 2026", event: "Checked out", detail: "Festival Sound 2026 — 8 units" },
    { date: "10 Mar 2026", event: "Returned", detail: "Corporate Gala — all units" },
    { date: "5 Mar 2026", event: "Maintenance", detail: "J8 Top Unit 04 — driver cone replaced" },
    { date: "28 Feb 2026", event: "Checked out", detail: "Tech Conference — 12 units" },
  ];

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
          <div className="flex flex-wrap gap-1.5 mt-1.5">
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px bg-white/[0.04] flex-shrink-0">
        <div className="bg-[#0d0d0d] px-3 py-3 flex flex-col items-center">
          <span className="text-lg font-bold text-white">{item.quantity}</span>
          <span className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Total</span>
        </div>
        <div className="bg-[#0d0d0d] px-3 py-3 flex flex-col items-center">
          <span className="text-lg font-bold text-emerald-400">{availableCount}</span>
          <span className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Available</span>
        </div>
        <div className="bg-[#0d0d0d] px-3 py-3 flex flex-col items-center">
          <span className="text-lg font-bold text-red-400">{maintenanceCount}</span>
          <span className="text-[9px] text-white/30 uppercase tracking-wider mt-0.5">Maintenance</span>
        </div>
      </div>

      {/* Section nav */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0">
        {[{ key: "units", label: "Units", icon: Boxes }, { key: "history", label: "History", icon: History }].map((s) => (
          <button key={s.key} onClick={() => setActiveSection(s.key as "units" | "history")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeSection === s.key ? "border-[#FFFF00] text-[#FFFF00]" : "border-transparent text-white/25 hover:text-white/50"}`}>
            <s.icon className="w-3.5 h-3.5" />{s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === "units" && (
          <div>
            {units.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-white/15">
                <Package className="w-8 h-8 mb-2" />
                <p className="text-sm">No units recorded</p>
              </div>
            ) : (
              units.map((u, i) => (
                <div key={u.id}
                  className="flex flex-col gap-1 px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white/80 font-medium truncate">{u.name}</span>
                    <StatusPill status={u.status} onClick={() => cycleStatus(u.id)} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-[10px] text-white/25">
                      <Hash className="w-2.5 h-2.5" />{u.serialNumber}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-white/25">
                      <Barcode className="w-2.5 h-2.5" />{u.barcodeNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-white/20 mt-0.5">
                    <MapPin className="w-2.5 h-2.5" />{u.location}
                  </div>
                </div>
              ))
            )}
            <p className="text-[9px] text-white/15 text-center py-2">Click a status badge to toggle it</p>
          </div>
        )}

        {activeSection === "history" && (
          <div className="p-4 space-y-3">
            {mockHistory.map((h, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#FFFF00]/40 mt-1 flex-shrink-0" />
                  {i < mockHistory.length - 1 && <div className="w-px flex-1 bg-white/[0.04]" />}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white/70">{h.event}</span>
                    <span className="text-[10px] text-white/25">{h.date}</span>
                  </div>
                  <p className="text-[11px] text-white/35 mt-0.5">{h.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
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
