import { useState } from "react";
import { X, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { stockApi, jobsApi, type CrewMember } from "@/api";
import { FileUploadField } from "@/components/FileUploadField";
import type { InsertMaintenanceLog } from "@shared/schema";

const TYPES = ["repair", "preventive", "inspection"];
const STATUSES = ["in_progress", "completed"];

const InputField = ({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 focus:outline-none focus:border-[#FFFF00]/40 transition-colors appearance-none cursor-pointer"
    >
      <option value="" className="bg-[#111]">Select…</option>
      {options.map((o) => <option key={o.value} value={o.value} className="bg-[#111]">{o.label}</option>)}
    </select>
  </div>
);

interface AddMaintenanceLogModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<InsertMaintenanceLog, "companyId">) => void;
}

export const AddMaintenanceLogModal = ({ onClose, onSubmit }: AddMaintenanceLogModalProps): JSX.Element => {
  const { token, companyId } = useAppStore();

  const [stockItemId, setStockItemId] = useState("");
  const [stockUnitId, setStockUnitId] = useState("");
  const [type, setType] = useState("repair");
  const [description, setDescription] = useState("");
  const [techId, setTechId] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("in_progress");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const { data: stockItems = [] } = useQuery({
    queryKey: ["stock"],
    queryFn: stockApi.getAll,
    enabled: !!token,
  });

  const { data: itemDetail } = useQuery({
    queryKey: ["stock", stockItemId],
    queryFn: () => stockApi.getById(stockItemId),
    enabled: !!token && !!stockItemId,
  });

  const { data: crewData } = useQuery({
    queryKey: ["crew"],
    queryFn: jobsApi.getCrew,
    enabled: !!token,
  });
  const crew: CrewMember[] = crewData?.crew ?? [];

  const handleSave = () => {
    if (!description.trim() || !date) return;
    onSubmit({
      stockUnitId: stockUnitId || null,
      type: type as InsertMaintenanceLog["type"],
      description: description.trim(),
      techId: techId || null,
      status: status as InsertMaintenanceLog["status"],
      cost: cost ? cost : null,
      receiptUrl,
      date: new Date(date),
    } as Omit<InsertMaintenanceLog, "companyId">);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FFFF00" }}>
              <Wrench className="w-3.5 h-3.5 text-black" />
            </div>
            <h2 className="text-sm font-bold text-white">Add Maintenance Log</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Stock Item" value={stockItemId}
              onChange={(v) => { setStockItemId(v); setStockUnitId(""); }}
              options={stockItems.map((i: any) => ({ value: i.id, label: i.itemName ?? i.name ?? i.id }))} />
            <SelectField label="Stock Unit" value={stockUnitId} onChange={setStockUnitId}
              options={(itemDetail?.units ?? []).map((u: any) => ({ value: u.id, label: u.serialNumber ? `${u.name} (${u.serialNumber})` : u.name }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Type" value={type} onChange={setType}
              options={TYPES.map((t) => ({ value: t, label: t }))} />
            <SelectField label="Status" value={status} onChange={setStatus}
              options={STATUSES.map((s) => ({ value: s, label: s }))} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What needs to be done / was done…"
              className="w-full bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 py-2 placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Technician" value={techId} onChange={setTechId}
              options={crew.map((c) => ({ value: c.id, label: c.name }))} />
            <InputField label="Cost (£)" type="number" value={cost} onChange={setCost} placeholder="e.g. 120.00" />
          </div>

          <InputField label="Date" type="date" value={date} onChange={setDate} />

          {companyId && (
            <FileUploadField label="Receipt / Bill" folder="maintenance" companyId={companyId}
              value={receiptUrl} onChange={setReceiptUrl} />
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-white/10 text-sm text-white/40 hover:text-white hover:border-white/20 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!description.trim() || !date}
            className="flex-1 h-9 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#FFFF00" }}>
            Save Log
          </button>
        </div>
      </div>
    </div>
  );
};
