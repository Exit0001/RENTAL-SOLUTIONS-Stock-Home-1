import React, { useState } from "react";
import { X, Pencil, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { catalogApi } from "@/api";
import { FileUploadField } from "@/components/FileUploadField";
import { ManageContainerTypesModal } from "./ManageContainerTypesModal";

interface EditContainerModalProps {
  container: { id: string; name: string; type: string; location: string | null; barcode: string | null; imageUrl?: string | null };
  onClose: () => void;
  onSave: (id: string, data: { name: string; type: string; location: string; barcode: string; imageUrl: string | null }) => void;
}

export const EditContainerModal = ({ container, onClose, onSave }: EditContainerModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token, companyId } = useAppStore();
  const [name, setName] = useState(container.name);
  const [type, setType] = useState(container.type);
  const [location, setLocation] = useState(container.location ?? "");
  const [barcode, setBarcode] = useState(container.barcode ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(container.imageUrl ?? null);
  const [manageTypesOpen, setManageTypesOpen] = useState(false);

  const { data: locations = [] } = useQuery({
    queryKey: ["catalog", "locations"], queryFn: catalogApi.getLocations, enabled: !!token,
  });
  const { data: containerTypes = [] } = useQuery({
    queryKey: ["catalog", "container-types"], queryFn: catalogApi.getContainerTypes, enabled: !!token,
  });

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(container.id, { name: name.trim(), type, location, barcode: barcode.trim(), imageUrl });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-surface-1 border border-fg/[0.08] rounded-2xl shadow-2xl animate-modal-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-fg/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--brand)" }}>
              <Pencil className="w-3.5 h-3.5 text-black" />
            </div>
            <h2 className="text-sm font-bold text-fg">{t("editContainer.title")}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-fg/60 hover:text-fg hover:bg-fg/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Container Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-fg/60 uppercase tracking-wider font-medium">{t("addContainer.containerType")}</label>
            <div className="flex gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="flex-1 h-9 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg px-3 focus:outline-none focus:border-brand/40 transition-colors appearance-none cursor-pointer"
              >
                {containerTypes.length === 0 && <option value={type} className="bg-surface-1">{type}</option>}
                {containerTypes.map((ct) => <option key={ct.id} value={ct.name} className="bg-surface-1">{ct.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setManageTypesOpen(true)}
                title={t("addContainer.manageTypesTitle")}
                className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg border border-fg/10 text-fg/60 hover:text-fg hover:border-fg/20 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-fg/60 uppercase tracking-wider font-medium">{t("addContainer.containerName")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("addContainer.containerNamePlaceholder")}
              className="w-full h-9 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg px-3 placeholder:text-fg/60 focus:outline-none focus:border-brand/40 transition-colors"
            />
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-fg/60 uppercase tracking-wider font-medium">{t("addContainer.storageLocation")}</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-9 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg px-3 focus:outline-none focus:border-brand/40 transition-colors appearance-none cursor-pointer"
            >
              {locations.length === 0 && <option value={location} className="bg-surface-1">{location}</option>}
              {locations.map((l) => <option key={l.id} value={l.name} className="bg-surface-1">{l.name}</option>)}
            </select>
          </div>

          {/* Barcode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-fg/60 uppercase tracking-wider font-medium">
              {t("addContainer.barcodeLabel")}
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder={t("addContainer.barcodePlaceholder")}
              className="w-full h-9 bg-black/40 border border-fg/10 rounded-lg text-sm text-fg px-3 font-mono placeholder:text-fg/60 focus:outline-none focus:border-brand/40 transition-colors"
            />
          </div>

          {/* Image */}
          <FileUploadField label={t("addContainer.imageLabel")} folder="containers" companyId={companyId ?? ""}
            value={imageUrl} onChange={setImageUrl} />
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-fg/10 text-sm text-fg/60 hover:text-fg hover:border-fg/20 transition-colors">
            {tc("cancel")}
          </button>
          <button onClick={handleSave} disabled={!name.trim() || !type}
            className="flex-1 h-9 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "var(--brand)" }}>
            {tc("save")}
          </button>
        </div>
      </div>

      {manageTypesOpen && (
        <ManageContainerTypesModal onClose={() => setManageTypesOpen(false)} />
      )}
    </div>
  );
};
