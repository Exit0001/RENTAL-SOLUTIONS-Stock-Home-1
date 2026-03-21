import React, { useState } from "react";
import { X, Layers, Hash, Trash2, Package, MapPin, Plus } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Unit {
  id: number;
  unitName: string;
  parentItem: string;
  serialNumber: string;
  barcodeNumber: string;
  storageLocation: string;
  initialStatus: "Available" | "Maintenance";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXISTING_ITEMS = [
  "d&b J8 Loudspeaker", "d&b J12 Loudspeaker", "d&b B22 Sub",
  "L-Acoustics K2", "L-Acoustics KS28", "Crown FP10000Q Amplifier",
  "Shure ULXD4 Wireless Receiver", "Shure SM58 Microphone",
];

const DEFAULT_STORAGE_LOCATIONS = [
  "Warehouse A, Zone 1", "Warehouse A, Zone 2", "Warehouse B", "Vehicle 1", "Offsite",
];

// ─── Helper ───────────────────────────────────────────────────────────────────

const InputField = ({
  label, placeholder, value, onChange,
}: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3
        placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
    />
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────

interface Props { onClose: () => void; }

export const AddIndividualUnitModal = ({ onClose }: Props): JSX.Element => {
  const [parentItem, setParentItem] = useState("");
  const [qty, setQty] = useState("1");
  const [prefix, setPrefix] = useState("SN");
  const [startNum, setStartNum] = useState("1");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [units, setUnits] = useState<Unit[]>([]);
  const [locations, setLocations] = useState<string[]>(DEFAULT_STORAGE_LOCATIONS);
  const [newLocation, setNewLocation] = useState("");
  const [showAddLocation, setShowAddLocation] = useState(false);

  const addLocation = () => {
    const trimmed = newLocation.trim();
    if (trimmed && !locations.includes(trimmed)) {
      setLocations((prev) => [...prev, trimmed]);
    }
    setNewLocation("");
    setShowAddLocation(false);
  };

  const suggestions = parentItem.trim()
    ? EXISTING_ITEMS.filter((item) => item.toLowerCase().includes(parentItem.toLowerCase()))
    : EXISTING_ITEMS;

  const generateUnits = () => {
    const q = parseInt(qty) || 1;
    const start = parseInt(startNum) || 1;
    const baseName = parentItem || "Unit";
    const newUnits: Unit[] = Array.from({ length: q }, (_, i) => {
      const num = String(start + i).padStart(2, "0");
      return {
        id: Date.now() + i,
        unitName: `${baseName} - Unit ${num}`,
        parentItem: baseName,
        serialNumber: "",
        barcodeNumber: `${prefix}-${num}`,
        storageLocation: "Warehouse A, Zone 1",
        initialStatus: "Available",
      };
    });
    setUnits((prev) => [...prev, ...newUnits]);
  };

  const updateUnit = (id: number, key: keyof Unit, val: string) =>
    setUnits((prev) => prev.map((u) => u.id === id ? { ...u, [key]: val } : u));

  const removeUnit = (id: number) =>
    setUnits((prev) => prev.filter((u) => u.id !== id));

  const handleSave = () => {
    console.log("Saving units:", units);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[88vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFFF00" }}>
              <Layers className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Add Individual Units</h2>
              <p className="text-[10px] text-white/30">Generate and configure individual unit records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

          {/* Parent Item search */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Parent Item</label>
            <input
              type="text"
              value={parentItem}
              onChange={(e) => { setParentItem(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Type or select a parent item…"
              className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3
                placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-[#111] border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-44">
                {suggestions.map((item) => (
                  <button
                    key={item}
                    onMouseDown={() => { setParentItem(item); setShowSuggestions(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-white/70 hover:bg-[#FFFF00]/10 hover:text-[#FFFF00] transition-colors"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generation controls */}
          <div className="flex items-end gap-3">
            <div className="w-24">
              <InputField label="Quantity" placeholder="1" value={qty} onChange={setQty} />
            </div>
            <div className="w-36">
              <InputField label="Barcode Prefix" placeholder="e.g. DBJ8" value={prefix} onChange={setPrefix} />
            </div>
            <div className="w-32">
              <InputField label="Start Number" placeholder="1" value={startNum} onChange={setStartNum} />
            </div>
            <button
              onClick={generateUnits}
              className="h-9 px-4 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 flex items-center gap-2 flex-shrink-0"
              style={{ backgroundColor: "#FFFF00" }}
            >
              <Hash className="w-3.5 h-3.5" />
              Generate
            </button>
          </div>

          {/* Add Location */}
          <div className="flex items-center gap-2">
            {showAddLocation ? (
              <>
                <MapPin className="w-3.5 h-3.5 text-[#FFFF00]/50 flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addLocation(); if (e.key === "Escape") setShowAddLocation(false); }}
                  placeholder="New location name…"
                  className="flex-1 h-8 bg-black/40 border border-[#FFFF00]/30 rounded-lg text-sm text-white px-3 placeholder:text-white/20 focus:outline-none transition-colors"
                />
                <button
                  onClick={addLocation}
                  className="h-8 px-3 rounded-lg text-xs font-bold text-black flex-shrink-0"
                  style={{ backgroundColor: "#FFFF00" }}
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddLocation(false); setNewLocation(""); }}
                  className="h-8 px-3 rounded-lg text-xs text-white/30 border border-white/10 hover:text-white transition-colors flex-shrink-0"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAddLocation(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-white/10 hover:border-[#FFFF00]/30 text-white/30 hover:text-[#FFFF00] text-xs transition-all"
              >
                <Plus className="w-3 h-3" />
                Add Location
              </button>
            )}
            {locations.length > DEFAULT_STORAGE_LOCATIONS.length && (
              <span className="text-[10px] text-white/20 ml-1">
                {locations.length - DEFAULT_STORAGE_LOCATIONS.length} custom
              </span>
            )}
          </div>

          {/* Units table */}
          {units.length > 0 ? (
            <div className="border border-white/[0.06] rounded-xl overflow-hidden">
              <div
                className="grid text-[10px] text-[#FFFF00]/40 uppercase tracking-wider font-semibold bg-black/20 px-3 py-2"
                style={{ gridTemplateColumns: "2fr 1.5fr 1.5fr 1.8fr 1.3fr 32px" }}
              >
                <span>Unit Name</span>
                <span>Serial No.</span>
                <span>Barcode</span>
                <span>Storage Location</span>
                <span>Status</span>
                <span />
              </div>
              <div className="max-h-72">
                {units.map((u, i) => (
                  <div
                    key={u.id}
                    className="grid items-center gap-2 px-3 py-1.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                    style={{ gridTemplateColumns: "2fr 1.5fr 1.5fr 1.8fr 1.3fr 32px", animationDelay: `${i * 20}ms` }}
                  >
                    <input
                      value={u.unitName}
                      onChange={(e) => updateUnit(u.id, "unitName", e.target.value)}
                      className="h-7 bg-transparent border-b border-white/10 text-sm text-white/80 px-1 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
                    />
                    <input
                      value={u.serialNumber}
                      onChange={(e) => updateUnit(u.id, "serialNumber", e.target.value)}
                      className="h-7 bg-transparent border-b border-white/10 text-xs font-mono text-white/60 px-1 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
                    />
                    <input
                      value={u.barcodeNumber}
                      onChange={(e) => updateUnit(u.id, "barcodeNumber", e.target.value)}
                      className="h-7 bg-transparent border-b border-white/10 text-xs font-mono text-white/60 px-1 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
                    />
                    <select
                      value={u.storageLocation}
                      onChange={(e) => updateUnit(u.id, "storageLocation", e.target.value)}
                      className="h-7 bg-black/40 border border-white/10 rounded text-xs text-white/70 px-1.5 focus:outline-none focus:border-[#FFFF00]/40 appearance-none cursor-pointer"
                    >
                      {locations.map((l) => <option key={l} value={l} className="bg-[#111]">{l}</option>)}
                    </select>
                    <select
                      value={u.initialStatus}
                      onChange={(e) => updateUnit(u.id, "initialStatus", e.target.value as Unit["initialStatus"])}
                      className={`h-7 border rounded text-xs px-1.5 focus:outline-none focus:border-[#FFFF00]/40 appearance-none cursor-pointer ${
                        u.initialStatus === "Available"
                          ? "bg-emerald-950/50 border-emerald-800/40 text-emerald-400"
                          : "bg-red-950/50 border-red-800/40 text-red-400"
                      }`}
                    >
                      <option value="Available" className="bg-[#111] text-white">Available</option>
                      <option value="Maintenance" className="bg-[#111] text-white">Maintenance</option>
                    </select>
                    <button
                      onClick={() => removeUnit(u.id)}
                      className="w-7 h-7 flex items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-white/15 border border-dashed border-white/[0.06] rounded-xl">
              <Package className="w-9 h-9 mb-2" />
              <p className="text-sm">Select a parent item, set quantity and click Generate</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-white/10 text-sm text-white/40 hover:text-white hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <div className="text-xs text-white/20">
            {units.length > 0 ? `${units.length} unit${units.length !== 1 ? "s" : ""} ready to save` : "No units added yet"}
          </div>
          <button
            onClick={handleSave}
            disabled={units.length === 0}
            className="h-9 px-6 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-30 disabled:pointer-events-none"
            style={{ backgroundColor: "#FFFF00" }}
          >
            Save Units
          </button>
        </div>
      </div>
    </div>
  );
};
