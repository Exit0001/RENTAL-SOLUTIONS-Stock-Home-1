import React, { useState } from "react";
import { X, Plus, Box, Layers, Briefcase, ShoppingBag } from "lucide-react";

const CONTAINER_TYPES = [
  { key: "Rack", label: "Rack", icon: Layers, desc: "Equipment rack (2U, 4U…)" },
  { key: "Case", label: "Case", icon: Briefcase, desc: "Hard-shell flight case" },
  { key: "Bag", label: "Bag", icon: ShoppingBag, desc: "Soft carry bag or pouch" },
  { key: "Box", label: "Box", icon: Box, desc: "Generic storage box" },
];

const LOCATIONS = ["Warehouse A, Zone 1", "Warehouse A, Zone 2", "Warehouse B", "Vehicle 1", "Offsite"];

interface AddContainerModalProps {
  onClose: () => void;
  onAdd: (container: { name: string; type: string; location: string; barcode: string }) => void;
}

export const AddContainerModal = ({ onClose, onAdd }: AddContainerModalProps): JSX.Element => {
  const [name, setName] = useState("");
  const [type, setType] = useState("Rack");
  const [location, setLocation] = useState("Warehouse A, Zone 1");
  const [barcode, setBarcode] = useState("");

  const handleSave = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), type, location, barcode: barcode.trim() || `${type.toUpperCase()}-${Date.now().toString().slice(-4)}` });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FFFF00" }}>
              <Plus className="w-3.5 h-3.5 text-black" />
            </div>
            <h2 className="text-sm font-bold text-white">Add Container</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Container Type */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Container Type</label>
            <div className="grid grid-cols-2 gap-2">
              {CONTAINER_TYPES.map((t) => {
                const Icon = t.icon;
                const active = type === t.key;
                return (
                  <button key={t.key} onClick={() => setType(t.key)}
                    className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                      active ? "border-[#FFFF00]/40 bg-[#FFFF00]/[0.06]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/10"}`}>
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? "text-[#FFFF00]" : "text-white/30"}`} />
                    <div>
                      <p className={`text-xs font-semibold ${active ? "text-[#FFFF00]" : "text-white/50"}`}>{t.label}</p>
                      <p className="text-[10px] text-white/20 leading-tight">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Container Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g. Rack A — Power Amp Rack`}
              className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
            />
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Storage Location</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 focus:outline-none focus:border-[#FFFF00]/40 transition-colors appearance-none cursor-pointer"
            >
              {LOCATIONS.map((l) => <option key={l} value={l} className="bg-[#111]">{l}</option>)}
            </select>
          </div>

          {/* Barcode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">
              Barcode / Label <span className="text-white/20 normal-case">(auto-generated if blank)</span>
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="e.g. RACK-A-001"
              className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 font-mono placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-white/10 text-sm text-white/40 hover:text-white hover:border-white/20 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!name.trim()}
            className="flex-1 h-9 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#FFFF00" }}>
            Create Container
          </button>
        </div>
      </div>
    </div>
  );
};
