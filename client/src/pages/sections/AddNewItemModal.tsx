import React, { useState } from "react";
import {
  X, ChevronRight, Plus, Trash2, Upload, FileText, Shield, Receipt,
  Calendar, Banknote, Layers, Package, Cpu, Lightbulb,
  Monitor, Settings, Hash,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "general" | "units" | "pricing" | "specs" | "documents";

interface Unit {
  id: number;
  unitName: string;
  parentItem: string;
  serialNumber: string;
  barcodeNumber: string;
  storageLocation: string;
  initialStatus: "Available" | "Maintenance";
}

interface SpecField { key: string; label: string; placeholder: string; }

const SPEC_TEMPLATES: Record<string, { label: string; icon: React.ElementType; fields: SpecField[] }> = {
  sound: {
    label: "Sound (Speakers / Amps)",
    icon: Cpu,
    fields: [
      { key: "impedance", label: "Impedance (Ohms)", placeholder: "e.g. 8" },
      { key: "wattage", label: "Wattage RMS (W)", placeholder: "e.g. 1500" },
      { key: "maxSpl", label: "Max SPL (dB)", placeholder: "e.g. 142" },
      { key: "freqResponse", label: "Frequency Response (Hz)", placeholder: "e.g. 55 – 18k" },
    ],
  },
  lighting: {
    label: "Lighting (Moving Head)",
    icon: Lightbulb,
    fields: [
      { key: "wattage", label: "Wattage (W)", placeholder: "e.g. 350" },
      { key: "beamAngle", label: "Beam Angle (°)", placeholder: "e.g. 3 – 36" },
      { key: "dmxChannels", label: "DMX Channels", placeholder: "e.g. 24" },
      { key: "ipRating", label: "IP Rating", placeholder: "e.g. IP20" },
    ],
  },
  video: {
    label: "Video (LED / Projector)",
    icon: Monitor,
    fields: [
      { key: "resolution", label: "Resolution", placeholder: "e.g. 1920 × 1080" },
      { key: "pixelPitch", label: "Pixel Pitch (mm)", placeholder: "e.g. 3.9" },
      { key: "brightness", label: "Brightness (lm)", placeholder: "e.g. 12000" },
      { key: "panelSize", label: "Panel Size", placeholder: "e.g. 500 × 500 mm" },
    ],
  },
  custom: {
    label: "Custom",
    icon: Settings,
    fields: [],
  },
};

const PROTOCOL_OPTIONS = ["Dante", "AES/EBU", "Milan", "Art-Net", "sACN", "AVB", "AES67", "MADI"];
const STORAGE_LOCATIONS = ["Warehouse A, Zone 1", "Warehouse A, Zone 2", "Warehouse B", "Vehicle 1", "Offsite"];

// ─── Sub-components ───────────────────────────────────────────────────────────

const InputField = ({
  label, placeholder, value, onChange, type = "text", icon,
}: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string; icon?: React.ElementType;
}) => {
  const Icon = icon;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/20
            focus:outline-none focus:border-[#FFFF00]/40 transition-colors ${Icon ? "pl-9 pr-3" : "px-3"}`}
        />
      </div>
    </div>
  );
};

const SelectField = ({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3
        focus:outline-none focus:border-[#FFFF00]/40 transition-colors appearance-none cursor-pointer"
    >
      <option value="" className="bg-[#111]">Select…</option>
      {options.map((o) => <option key={o} value={o} className="bg-[#111]">{o}</option>)}
    </select>
  </div>
);

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
    <h4 className="text-xs font-bold text-[#FFFF00]/80 uppercase tracking-widest mb-4">{title}</h4>
    {children}
  </div>
);

const FileDropZone = ({ label, icon: Icon, fileName, onClear }: {
  label: string; icon: React.ElementType; fileName?: string; onClear?: () => void;
}) => (
  <div className="relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-white/10 hover:border-[#FFFF00]/30 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer group min-h-[110px]">
    {fileName && (
      <button onClick={onClear} className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-white/10 hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors">
        <X className="w-3 h-3" />
      </button>
    )}
    <Icon className={`w-6 h-6 ${fileName ? "text-[#FFFF00]/50" : "text-white/15 group-hover:text-white/30"} transition-colors`} />
    {fileName ? (
      <span className="text-[10px] text-[#FFFF00]/60 text-center break-all px-2">{fileName}</span>
    ) : (
      <>
        <span className="text-[11px] font-medium text-white/30 group-hover:text-white/50 transition-colors text-center">{label}</span>
        <span className="text-[9px] text-white/15">Drag and drop</span>
      </>
    )}
  </div>
);

// ─── Tab: General ─────────────────────────────────────────────────────────────

interface GeneralData {
  itemName: string; manufacturer: string; manufacturerCountry: string;
  brand: string; category: string; subCategory: string; description: string; imageFile?: string;
}
const GeneralTab = ({ data, onChange }: { data: GeneralData; onChange: (d: GeneralData) => void }) => {
  const set = (key: keyof GeneralData) => (v: string) => onChange({ ...data, [key]: v });
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <InputField label="Item Name" placeholder="e.g. J8 Loudspeaker" value={data.itemName} onChange={set("itemName")} />
        <InputField label="Manufacturer" placeholder="e.g. d&b audiotechnik" value={data.manufacturer} onChange={set("manufacturer")} />
        <InputField label="Manufacturer Country" placeholder="e.g. Germany" value={data.manufacturerCountry} onChange={set("manufacturerCountry")} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SelectField label="Brand" value={data.brand} onChange={set("brand")} options={["d&b audiotechnik", "L-Acoustics", "Shure", "Senheiser"]} />
        <SelectField label="Category" value={data.category} onChange={set("category")} options={["Speakers", "Cable", "Rigging", "Safety", "Microphones"]} />
        <SelectField label="Sub-Category" value={data.subCategory} onChange={set("subCategory")} options={["Line Array", "Moving Heads", "Ground Stacks", "LED Wall", "In-Ear"]} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Description</label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Describe the item, its use case, and any important notes…"
          rows={3}
          className="w-full bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 py-2.5 placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-colors resize-none"
        />
      </div>
      <div className="flex gap-4 items-start">
        <div className="flex flex-col items-center justify-center gap-2 w-44 h-32 rounded-xl border border-dashed border-white/10 hover:border-[#FFFF00]/30 bg-white/[0.02] hover:bg-[#FFFF00]/[0.03] cursor-pointer transition-all group">
          <Upload className="w-5 h-5 text-white/20 group-hover:text-[#FFFF00]/40 transition-colors" />
          <span className="text-[11px] text-white/25 group-hover:text-white/40 transition-colors text-center">Drag and drop<br/>or Upload Image</span>
        </div>
        {data.imageFile && (
          <div className="w-32 h-32 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
            <Package className="w-10 h-10 text-white/20" />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Individual Units ────────────────────────────────────────────────────

const UnitsTab = ({ itemName, units, onUnitsChange }: {
  itemName: string; units: Unit[]; onUnitsChange: (u: Unit[]) => void;
}) => {
  const [qty, setQty] = useState("7");
  const [prefix, setPrefix] = useState("SN");
  const [startNum, setStartNum] = useState("1");

  const generateUnits = () => {
    const q = parseInt(qty) || 1;
    const start = parseInt(startNum) || 1;
    const baseName = itemName || "Unit";
    const newUnits: Unit[] = Array.from({ length: q }, (_, i) => {
      const num = String(start + i).padStart(2, "0");
      return {
        id: Date.now() + i,
        unitName: `${baseName} - Unit ${num}`,
        parentItem: baseName,
        serialNumber: `${prefix}-${num}`,
        barcodeNumber: `BC-${Date.now().toString().slice(-6)}${num}`,
        storageLocation: "Warehouse A, Zone 1",
        initialStatus: "Available",
      };
    });
    onUnitsChange(newUnits);
  };

  const updateUnit = (id: number, key: keyof Unit, val: string) =>
    onUnitsChange(units.map((u) => u.id === id ? { ...u, [key]: val } : u));

  const removeUnit = (id: number) => onUnitsChange(units.filter((u) => u.id !== id));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <div className="w-24">
          <InputField label="Quantity" placeholder="7" value={qty} onChange={setQty} />
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
          Add Units
        </button>
      </div>

      {units.length > 0 ? (
        <div className="border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="grid text-[10px] text-[#FFFF00]/40 uppercase tracking-wider font-semibold bg-black/20 px-3 py-2"
            style={{ gridTemplateColumns: "1.8fr 1.4fr 1.2fr 1.2fr 1.6fr 1.2fr 32px" }}>
            <span>Unit Name</span>
            <span>Parent Item</span>
            <span>Serial No.</span>
            <span>Barcode</span>
            <span>Storage Location</span>
            <span>Status</span>
            <span />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {units.map((u, i) => (
              <div key={u.id}
                className="grid items-center gap-2 px-3 py-1.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] animate-slide-down"
                style={{ gridTemplateColumns: "1.8fr 1.4fr 1.2fr 1.2fr 1.6fr 1.2fr 32px", animationDelay: `${i * 20}ms` }}
              >
                <input value={u.unitName} onChange={(e) => updateUnit(u.id, "unitName", e.target.value)}
                  className="h-7 bg-transparent border-b border-white/10 text-sm text-white/80 px-1 focus:outline-none focus:border-[#FFFF00]/40 transition-colors" />
                <input value={u.parentItem} onChange={(e) => updateUnit(u.id, "parentItem", e.target.value)}
                  placeholder="Parent item…"
                  className="h-7 bg-transparent border-b border-white/10 text-xs text-[#FFFF00]/60 px-1 focus:outline-none focus:border-[#FFFF00]/40 transition-colors placeholder:text-white/15" />
                <input value={u.serialNumber} onChange={(e) => updateUnit(u.id, "serialNumber", e.target.value)}
                  className="h-7 bg-transparent border-b border-white/10 text-xs font-mono text-white/60 px-1 focus:outline-none focus:border-[#FFFF00]/40 transition-colors" />
                <input value={u.barcodeNumber} onChange={(e) => updateUnit(u.id, "barcodeNumber", e.target.value)}
                  className="h-7 bg-transparent border-b border-white/10 text-xs font-mono text-white/60 px-1 focus:outline-none focus:border-[#FFFF00]/40 transition-colors" />
                <select value={u.storageLocation} onChange={(e) => updateUnit(u.id, "storageLocation", e.target.value)}
                  className="h-7 bg-black/40 border border-white/10 rounded text-xs text-white/70 px-1.5 focus:outline-none focus:border-[#FFFF00]/40 appearance-none cursor-pointer">
                  {STORAGE_LOCATIONS.map((l) => <option key={l} value={l} className="bg-[#111]">{l}</option>)}
                </select>
                <select value={u.initialStatus} onChange={(e) => updateUnit(u.id, "initialStatus", e.target.value as Unit["initialStatus"])}
                  className={`h-7 border rounded text-xs px-1.5 focus:outline-none focus:border-[#FFFF00]/40 appearance-none cursor-pointer ${
                    u.initialStatus === "Available" ? "bg-emerald-950/50 border-emerald-800/40 text-emerald-400" : "bg-red-950/50 border-red-800/40 text-red-400"}`}>
                  <option value="Available" className="bg-[#111] text-white">Available</option>
                  <option value="Maintenance" className="bg-[#111] text-white">Maintenance</option>
                </select>
                <button onClick={() => removeUnit(u.id)} className="w-7 h-7 flex items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-white/15">
          <Package className="w-8 h-8 mb-2" />
          <p className="text-sm">Set quantity and click "Add Units" to generate</p>
        </div>
      )}
    </div>
  );
};

// ─── Tab: Pricing & Finance ───────────────────────────────────────────────────

interface PricingData {
  purchaseCost: string; purchaseDate: string;
  dailyRate: string; weeklyRate: string; replacementValue: string; securityDeposit: string;
}
const PricingTab = ({ data, onChange }: { data: PricingData; onChange: (d: PricingData) => void }) => {
  const set = (key: keyof PricingData) => (v: string) => onChange({ ...data, [key]: v });
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Procurement">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Purchase Cost (THB)" placeholder="e.g. 280,000" value={data.purchaseCost} onChange={set("purchaseCost")} icon={Banknote} />
          <InputField label="Purchase Date" placeholder="YYYY-MM-DD" type="date" value={data.purchaseDate} onChange={set("purchaseDate")} icon={Calendar} />
        </div>
      </SectionCard>
      <SectionCard title="Rental Pricing">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Daily Rental Rate (THB)" placeholder="e.g. 2,500" value={data.dailyRate} onChange={set("dailyRate")} icon={Banknote} />
          <InputField label="Weekly Rental Rate (THB)" placeholder="e.g. 12,000" value={data.weeklyRate} onChange={set("weeklyRate")} icon={Banknote} />
          <InputField label="Replacement Value (THB)" placeholder="e.g. 320,000" value={data.replacementValue} onChange={set("replacementValue")} icon={Banknote} />
          <InputField label="Security Deposit (THB)" placeholder="e.g. 50,000" value={data.securityDeposit} onChange={set("securityDeposit")} icon={Banknote} />
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Tab: Logistics & Specs ───────────────────────────────────────────────────

interface SpecsData {
  template: string;
  fields: Record<string, string>;
  customFields: { key: string; label: string; value: string }[];
  protocolTags: string[];
  customProtocolOptions: string[];
  weight: string; dimensions: string;
}
const SpecsTab = ({ data, onChange }: { data: SpecsData; onChange: (d: SpecsData) => void }) => {
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const tpl = SPEC_TEMPLATES[data.template] ?? SPEC_TEMPLATES.sound;

  const setField = (key: string, val: string) =>
    onChange({ ...data, fields: { ...data.fields, [key]: val } });

  const allProtocolOptions = [...PROTOCOL_OPTIONS, ...(data.customProtocolOptions ?? [])];

  const toggleTag = (tag: string) =>
    onChange({
      ...data,
      protocolTags: data.protocolTags.includes(tag)
        ? data.protocolTags.filter((t) => t !== tag)
        : [...data.protocolTags, tag],
    });

  const addProtocolTag = () => {
    const tag = newTagInput.trim();
    if (!tag || allProtocolOptions.includes(tag)) return;
    onChange({
      ...data,
      customProtocolOptions: [...(data.customProtocolOptions ?? []), tag],
      protocolTags: [...data.protocolTags, tag],
    });
    setNewTagInput("");
  };

  const addCustomField = () => {
    if (!newCustomLabel.trim()) return;
    onChange({
      ...data,
      customFields: [...data.customFields, { key: `cf_${Date.now()}`, label: newCustomLabel, value: "" }],
    });
    setNewCustomLabel("");
  };

  const setCustomField = (key: string, value: string) =>
    onChange({ ...data, customFields: data.customFields.map((f) => f.key === key ? { ...f, value } : f) });

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Dynamic Attributes & Specs (Category-Based)">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Select Spec Template</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(SPEC_TEMPLATES).map(([key, t]) => {
                const Icon = t.icon;
                const active = data.template === key;
                return (
                  <button key={key} onClick={() => onChange({ ...data, template: key })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                      active ? "border-[#FFFF00]/50 bg-[#FFFF00]/10 text-[#FFFF00]" : "border-white/10 bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white/60"}`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {tpl.fields.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {tpl.fields.map((f) => (
                <InputField key={f.key} label={f.label} placeholder={f.placeholder}
                  value={data.fields[f.key] ?? ""} onChange={(v) => setField(f.key, v)} />
              ))}
            </div>
          )}

          {data.customFields.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {data.customFields.map((f) => (
                <InputField key={f.key} label={f.label} placeholder="Value"
                  value={f.value} onChange={(v) => setCustomField(f.key, v)} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input value={newCustomLabel} onChange={(e) => setNewCustomLabel(e.target.value)}
              placeholder="Add custom spec field name…"
              onKeyDown={(e) => e.key === "Enter" && addCustomField()}
              className="flex-1 h-8 bg-black/40 border border-dashed border-white/10 rounded-lg text-sm text-white px-3 placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/30 transition-colors" />
            <button onClick={addCustomField}
              className="h-8 px-3 rounded-lg border border-dashed border-white/10 hover:border-[#FFFF00]/30 text-white/30 hover:text-[#FFFF00] text-xs flex items-center gap-1.5 transition-all">
              <Plus className="w-3 h-3" /> Add Field
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Protocol Tags</label>
            <div className="flex flex-wrap gap-2">
              {allProtocolOptions.map((tag) => {
                const active = data.protocolTags.includes(tag);
                const isCustom = (data.customProtocolOptions ?? []).includes(tag);
                return (
                  <button key={tag} onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                      active ? "border-[#FFFF00]/50 bg-[#FFFF00]/10 text-[#FFFF00]" : "border-white/10 text-white/30 hover:border-white/20 hover:text-white/50"}`}>
                    {isCustom && <span className="text-[8px] opacity-60">★</span>}
                    {tag}
                    {active && <span className="text-[#FFFF00]/60">×</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addProtocolTag()}
                placeholder="Add custom protocol tag… (press Enter)"
                className="flex-1 h-8 bg-black/40 border border-dashed border-white/10 rounded-lg text-xs text-white px-3 placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/30 transition-colors"
              />
              <button onClick={addProtocolTag}
                className="h-8 px-3 rounded-lg border border-dashed border-white/10 hover:border-[#FFFF00]/30 text-white/30 hover:text-[#FFFF00] text-xs flex items-center gap-1.5 transition-all flex-shrink-0">
                <Plus className="w-3 h-3" /> Add Tag
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Physical Attributes">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Weight (kg)" placeholder="e.g. 28.5" value={data.weight} onChange={(v) => onChange({ ...data, weight: v })} />
          <InputField label="Dimensions (W × H × D mm)" placeholder="e.g. 570 × 740 × 500" value={data.dimensions} onChange={(v) => onChange({ ...data, dimensions: v })} />
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Tab: Documents & Warranty ────────────────────────────────────────────────

interface DocsData {
  warrantyExpiry: string; supplierName: string; supportContact: string;
  manualFile?: string; certFile?: string; invoiceFile?: string;
}
const DocsTab = ({ data, onChange }: { data: DocsData; onChange: (d: DocsData) => void }) => {
  const set = (key: keyof DocsData) => (v: string) => onChange({ ...data, [key]: v });
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Warranty & Support">
        <div className="grid grid-cols-3 gap-4">
          <InputField label="Warranty Expiry Date" placeholder="YYYY-MM-DD" type="date" value={data.warrantyExpiry} onChange={set("warrantyExpiry")} icon={Calendar} />
          <InputField label="Supplier Name" placeholder="e.g. AV Pro Thailand" value={data.supplierName} onChange={set("supplierName")} />
          <InputField label="Support Contact" placeholder="e.g. +66 2 XXX XXXX" value={data.supportContact} onChange={set("supportContact")} />
        </div>
      </SectionCard>

      <SectionCard title="Documents">
        <div className="grid grid-cols-3 gap-4">
          <FileDropZone label="User Manual (PDF)" icon={FileText}
            fileName={data.manualFile} onClear={() => onChange({ ...data, manualFile: undefined })} />
          <FileDropZone label="Safety Certificate" icon={Shield}
            fileName={data.certFile} onClear={() => onChange({ ...data, certFile: undefined })} />
          <FileDropZone label="Purchase Invoice" icon={Receipt}
            fileName={data.invoiceFile} onClear={() => onChange({ ...data, invoiceFile: undefined })} />
        </div>
        <p className="text-[10px] text-white/20 mt-3">Accepted formats: PDF, JPG, PNG — max 20 MB each</p>
      </SectionCard>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "general",   label: "General",             icon: Package },
  { key: "units",     label: "Individual Units",    icon: Layers },
  { key: "pricing",   label: "Pricing & Finance",   icon: Banknote },
  { key: "specs",     label: "Logistics & Specs",   icon: Cpu },
  { key: "documents", label: "Documents & Warranty", icon: FileText },
];

interface AddNewItemModalProps { onClose: () => void; }

export const AddNewItemModal = ({ onClose }: AddNewItemModalProps): JSX.Element => {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [general, setGeneral] = useState<GeneralData>({
    itemName: "", manufacturer: "", manufacturerCountry: "",
    brand: "", category: "", subCategory: "", description: "",
  });
  const [units, setUnits] = useState<Unit[]>([]);
  const [pricing, setPricing] = useState<PricingData>({
    purchaseCost: "", purchaseDate: "", dailyRate: "", weeklyRate: "",
    replacementValue: "", securityDeposit: "",
  });
  const [specs, setSpecs] = useState<SpecsData>({
    template: "sound", fields: {}, customFields: [], protocolTags: [], customProtocolOptions: [], weight: "", dimensions: "",
  });
  const [docs, setDocs] = useState<DocsData>({
    warrantyExpiry: "", supplierName: "", supportContact: "",
  });

  const tabOrder: TabKey[] = ["general", "units", "pricing", "specs", "documents"];
  const currentIdx = tabOrder.indexOf(activeTab);
  const canGoNext = currentIdx < tabOrder.length - 1;
  const canGoPrev = currentIdx > 0;

  const handleSave = () => {
    console.log("Saving item:", { general, units, pricing, specs, docs });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFFF00" }}>
              <Plus className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Add New Item</h2>
              <p className="text-[10px] text-white/30 capitalize">{TABS.find(t => t.key === activeTab)?.label}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex items-center px-6 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto">
          {TABS.map((t, i) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            const isDone = tabOrder.indexOf(t.key) < currentIdx;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive ? "border-[#FFFF00] text-[#FFFF00]" : isDone ? "border-transparent text-white/40 hover:text-white/60" : "border-transparent text-white/20 hover:text-white/40"}`}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "general"   && <GeneralTab data={general} onChange={setGeneral} />}
          {activeTab === "units"     && <UnitsTab itemName={general.itemName} units={units} onUnitsChange={setUnits} />}
          {activeTab === "pricing"   && <PricingTab data={pricing} onChange={setPricing} />}
          {activeTab === "specs"     && <SpecsTab data={specs} onChange={setSpecs} />}
          {activeTab === "documents" && <DocsTab data={docs} onChange={setDocs} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
          <button
            onClick={() => canGoPrev && setActiveTab(tabOrder[currentIdx - 1])}
            disabled={!canGoPrev}
            className="h-9 px-4 rounded-lg border border-white/10 text-sm text-white/40 hover:text-white hover:border-white/20 transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            Back
          </button>
          <div className="flex items-center gap-1.5">
            {tabOrder.map((k, i) => (
              <span key={k} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIdx ? "bg-[#FFFF00] w-4" : i < currentIdx ? "bg-[#FFFF00]/40" : "bg-white/10"}`} />
            ))}
          </div>
          {canGoNext ? (
            <button
              onClick={() => setActiveTab(tabOrder[currentIdx + 1])}
              className="h-9 px-5 rounded-lg text-sm font-bold text-black flex items-center gap-2 transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#FFFF00" }}
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="h-9 px-6 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#FFFF00" }}
            >
              Save Item
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
