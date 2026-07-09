import React, { useState, useEffect } from "react";
import { X, Plus, Minus, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { catalogApi } from "@/api";
import { FileUploadField } from "@/components/FileUploadField";
import { ManageContainerTypesModal } from "./ManageContainerTypesModal";

interface AddContainerModalProps {
  onClose: () => void;
  onAdd: (containers: { name: string; type: string; location: string; barcode: string; imageUrl: string | null }[]) => void;
}

export const AddContainerModal = ({ onClose, onAdd }: AddContainerModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token, companyId } = useAppStore();
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [manageTypesOpen, setManageTypesOpen] = useState(false);

  const { data: locations = [] } = useQuery({
    queryKey: ["catalog", "locations"], queryFn: catalogApi.getLocations, enabled: !!token,
  });
  const { data: containerTypes = [] } = useQuery({
    queryKey: ["catalog", "container-types"], queryFn: catalogApi.getContainerTypes, enabled: !!token,
  });

  // ตั้งค่า default location เป็นตัวแรกจาก DB ตอนโหลดมาเสร็จ
  useEffect(() => {
    if (!location && locations.length > 0) setLocation(locations[0].name);
  }, [locations, location]);

  // ตั้งค่า default container type เป็นตัวแรกจาก DB ตอนโหลดมาเสร็จ
  useEffect(() => {
    if (!type && containerTypes.length > 0) setType(containerTypes[0].name);
  }, [containerTypes, type]);

  const handleSave = () => {
    if (!name.trim()) return;
    const trimmedName    = name.trim();
    const trimmedBarcode = barcode.trim();
    const n = Math.max(1, quantity);

    const containers = Array.from({ length: n }, (_, i) => {
      const suffix = n > 1 ? ` #${i + 1}` : "";
      const autoBarcode = `${type.toUpperCase()}-${Date.now().toString().slice(-4)}${n > 1 ? `-${i + 1}` : ""}`;
      const itemBarcode = trimmedBarcode
        ? (n > 1 ? `${trimmedBarcode}-${i + 1}` : trimmedBarcode)
        : autoBarcode;
      return { name: `${trimmedName}${suffix}`, type, location, barcode: itemBarcode, imageUrl };
    });

    onAdd(containers);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FFFF00" }}>
              <Plus className="w-3.5 h-3.5 text-black" />
            </div>
            <h2 className="text-sm font-bold text-white">{t("addContainer.title")}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Container Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{t("addContainer.containerType")}</label>
            <div className="flex gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="flex-1 h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 focus:outline-none focus:border-[#FFFF00]/40 transition-colors appearance-none cursor-pointer"
              >
                {containerTypes.length === 0 && <option value="" className="bg-[#111]">{t("addContainer.noTypesYet")}</option>}
                {containerTypes.map((ct) => <option key={ct.id} value={ct.name} className="bg-[#111]">{ct.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setManageTypesOpen(true)}
                title={t("addContainer.manageTypesTitle")}
                className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{t("addContainer.containerName")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("addContainer.containerNamePlaceholder")}
              className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
            />
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">
              {t("addContainer.quantityLabel")} <span className="text-white/60 normal-case">{t("addContainer.quantityHint")}</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors flex-shrink-0"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-16 h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white text-center focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{t("addContainer.storageLocation")}</label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 focus:outline-none focus:border-[#FFFF00]/40 transition-colors appearance-none cursor-pointer"
            >
              {locations.length === 0 && <option value="" className="bg-[#111]">{t("addContainer.noLocationsYet")}</option>}
              {locations.map((l) => <option key={l.id} value={l.name} className="bg-[#111]">{l.name}</option>)}
            </select>
          </div>

          {/* Barcode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">
              {t("addContainer.barcodeLabel")} <span className="text-white/60 normal-case">{t("addContainer.autoGeneratedHint")}</span>
            </label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder={t("addContainer.barcodePlaceholder")}
              className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 font-mono placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
            />
          </div>

          {/* Image */}
          <FileUploadField label={t("addContainer.imageLabel")} folder="containers" companyId={companyId ?? ""}
            value={imageUrl} onChange={setImageUrl} />
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 h-9 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors">
            {tc("cancel")}
          </button>
          <button onClick={handleSave} disabled={!name.trim() || !type}
            className="flex-1 h-9 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#FFFF00" }}>
            {quantity > 1 ? t("addContainer.createContainerCount", { count: quantity }) : t("addContainer.createContainer")}
          </button>
        </div>
      </div>

      {manageTypesOpen && (
        <ManageContainerTypesModal onClose={() => setManageTypesOpen(false)} />
      )}
    </div>
  );
};
