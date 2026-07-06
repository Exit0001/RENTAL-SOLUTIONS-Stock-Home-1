import React, { useState } from "react";
import {
  X, ChevronRight, Plus, FileText, Pencil,
  Calendar, Banknote, Package, Cpu, Lightbulb,
  Monitor, Settings,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useAppStore } from "@/store/appStore";
import { catalogApi } from "@/api";
import { FileUploadField } from "@/components/FileUploadField";
import type { InsertStockItem, StockItem } from "@shared/schema";

// ─── helpers for pre-populating edit state ────────────────────────────────────

const dateToInput = (v: any): string => {
  if (!v) return "";
  try { return new Date(v).toISOString().split("T")[0]; } catch { return ""; }
};

const initGeneral = (item?: StockItem): GeneralData => item ? {
  itemName: item.name,
  manufacturer: item.manufacturer ?? "",
  manufacturerCountry: item.manufacturerCountry ?? "",
  brand: item.brand,
  category: item.category,
  subCategory: item.subCategory,
  description: item.description ?? "",
  imageUrl: item.imageUrl ?? null,
  trackingMode: (item.trackingMode ?? "unit") as "unit" | "bulk",
  bulkQuantity: item.quantity?.toString() ?? "0",
} : { itemName: "", manufacturer: "", manufacturerCountry: "", brand: "", category: "", subCategory: "", description: "", imageUrl: null, trackingMode: "unit", bulkQuantity: "0" };

const initPricing = (item?: StockItem): PricingData => item ? {
  purchaseCost:     item.purchaseCost?.toString()     ?? "",
  purchaseDate:     dateToInput(item.purchaseDate),
  dailyRate:        item.dailyRate?.toString()        ?? "",
  weeklyRate:       item.weeklyRate?.toString()       ?? "",
  replacementValue: item.replacementValue?.toString() ?? "",
  securityDeposit:  item.securityDeposit?.toString()  ?? "",
} : { purchaseCost: "", purchaseDate: "", dailyRate: "", weeklyRate: "", replacementValue: "", securityDeposit: "" };

const initSpecs = (item?: StockItem): SpecsData => item ? {
  template:              item.specs?.template              ?? "sound",
  fields:                item.specs?.fields                ?? {},
  customFields:          item.specs?.customFields          ?? [],
  protocolTags:          item.specs?.protocolTags          ?? [],
  customProtocolOptions: item.specs?.customProtocolOptions ?? [],
  weight:     item.weight?.toString() ?? "",
  dimensions: item.dimensions        ?? "",
} : { template: "sound", fields: {}, customFields: [], protocolTags: [], customProtocolOptions: [], weight: "", dimensions: "" };

const initDocs = (item?: StockItem): DocsData => item ? {
  warrantyExpiry: dateToInput(item.warrantyExpiry),
  supplierName:   item.supplierName   ?? "",
  supportContact: item.supportContact ?? "",
  manualUrl:      item.manualUrl      ?? null,
  certUrl:        item.certUrl        ?? null,
  invoiceUrl:     item.invoiceUrl     ?? null,
} : { warrantyExpiry: "", supplierName: "", supportContact: "", manualUrl: null, certUrl: null, invoiceUrl: null };

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = "general" | "pricing" | "specs" | "documents";

interface SpecField { key: string; label: string; placeholder: string; }

const getSpecTemplates = (t: TFunction): Record<string, { label: string; icon: React.ElementType; fields: SpecField[] }> => ({
  sound: {
    label: t("addNewItem.specTemplateSound"),
    icon: Cpu,
    fields: [
      { key: "impedance", label: t("addNewItem.specImpedanceLabel"), placeholder: t("addNewItem.specImpedancePlaceholder") },
      { key: "wattage", label: t("addNewItem.specWattageRmsLabel"), placeholder: t("addNewItem.specWattageRmsPlaceholder") },
      { key: "maxSpl", label: t("addNewItem.specMaxSplLabel"), placeholder: t("addNewItem.specMaxSplPlaceholder") },
      { key: "freqResponse", label: t("addNewItem.specFreqResponseLabel"), placeholder: t("addNewItem.specFreqResponsePlaceholder") },
    ],
  },
  lighting: {
    label: t("addNewItem.specTemplateLighting"),
    icon: Lightbulb,
    fields: [
      { key: "wattage", label: t("addNewItem.specWattageLabel"), placeholder: t("addNewItem.specWattagePlaceholder") },
      { key: "beamAngle", label: t("addNewItem.specBeamAngleLabel"), placeholder: t("addNewItem.specBeamAnglePlaceholder") },
      { key: "dmxChannels", label: t("addNewItem.specDmxChannelsLabel"), placeholder: t("addNewItem.specDmxChannelsPlaceholder") },
      { key: "ipRating", label: t("addNewItem.specIpRatingLabel"), placeholder: t("addNewItem.specIpRatingPlaceholder") },
    ],
  },
  video: {
    label: t("addNewItem.specTemplateVideo"),
    icon: Monitor,
    fields: [
      { key: "resolution", label: t("addNewItem.specResolutionLabel"), placeholder: t("addNewItem.specResolutionPlaceholder") },
      { key: "pixelPitch", label: t("addNewItem.specPixelPitchLabel"), placeholder: t("addNewItem.specPixelPitchPlaceholder") },
      { key: "brightness", label: t("addNewItem.specBrightnessLabel"), placeholder: t("addNewItem.specBrightnessPlaceholder") },
      { key: "panelSize", label: t("addNewItem.specPanelSizeLabel"), placeholder: t("addNewItem.specPanelSizePlaceholder") },
    ],
  },
  custom: {
    label: t("addNewItem.specTemplateCustom"),
    icon: Settings,
    fields: [],
  },
});

const PROTOCOL_OPTIONS = ["Dante", "AES/EBU", "Milan", "Art-Net", "sACN", "AVB", "AES67", "MADI"];

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
      <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/60
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
}) => {
  const { t: tc } = useTranslation("common");
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3
          focus:outline-none focus:border-[#FFFF00]/40 transition-colors appearance-none cursor-pointer"
      >
        <option value="" className="bg-[#111]">{tc("selectPlaceholder")}</option>
        {options.map((o) => <option key={o} value={o} className="bg-[#111]">{o}</option>)}
      </select>
    </div>
  );
};

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
    <h4 className="text-xs font-bold text-[#FFFF00]/80 uppercase tracking-widest mb-4">{title}</h4>
    {children}
  </div>
);

// ─── Tab: General ─────────────────────────────────────────────────────────────

interface GeneralData {
  itemName: string; manufacturer: string; manufacturerCountry: string;
  brand: string; category: string; subCategory: string; description: string;
  imageUrl: string | null;
  trackingMode: "unit" | "bulk";
  bulkQuantity: string;
}
const GeneralTab = ({ data, onChange, companyId, brandOptions, categoryOptions, subCategoryOptions }: {
  data: GeneralData; onChange: (d: GeneralData) => void; companyId: string;
  brandOptions: string[]; categoryOptions: string[]; subCategoryOptions: string[];
}) => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const set = (key: keyof GeneralData) => (v: string) => onChange({ ...data, [key]: v });
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <InputField label={t("addNewItem.itemName")} placeholder={t("addNewItem.itemNamePlaceholder")} value={data.itemName} onChange={set("itemName")} />
        <InputField label={t("addNewItem.manufacturerLabel")} placeholder={t("addNewItem.manufacturerPlaceholder")} value={data.manufacturer} onChange={set("manufacturer")} />
        <InputField label={t("addNewItem.manufacturerCountry")} placeholder={t("addNewItem.manufacturerCountryPlaceholder")} value={data.manufacturerCountry} onChange={set("manufacturerCountry")} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <SelectField label={tc("brand")} value={data.brand} onChange={set("brand")} options={brandOptions} />
        <SelectField label={tc("category")} value={data.category} onChange={set("category")} options={categoryOptions} />
        <SelectField label={t("addNewItem.subCategoryLabel")} value={data.subCategory} onChange={set("subCategory")} options={subCategoryOptions} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{tc("description")}</label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder={t("addNewItem.descriptionPlaceholder")}
          rows={3}
          className="w-full bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3 py-2.5 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors resize-none"
        />
      </div>
      <FileUploadField label={t("addNewItem.itemImage")} folder="stock-items" companyId={companyId}
        value={data.imageUrl} onChange={(url) => onChange({ ...data, imageUrl: url })} />

      {/* Tracking mode */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">
          {t("addNewItem.trackingModeLabel")}
        </label>
        <div className="flex gap-2">
          {(["unit", "bulk"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ ...data, trackingMode: mode })}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                data.trackingMode === mode
                  ? "border-[#FFFF00] text-black"
                  : "border-white/10 text-white/60 hover:border-white/30 hover:text-white"
              }`}
              style={data.trackingMode === mode ? { backgroundColor: "#FFFF00" } : undefined}
            >
              {mode === "unit" ? t("addNewItem.trackingModeUnit") : t("addNewItem.trackingModeBulk")}
            </button>
          ))}
        </div>
      </div>

      {data.trackingMode === "bulk" && (
        <InputField
          label={t("addNewItem.bulkTotalQty")}
          placeholder="100"
          type="number"
          value={data.bulkQuantity}
          onChange={(v) => onChange({ ...data, bulkQuantity: v })}
          icon={Package}
        />
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
  const { t } = useTranslation("modals");
  const set = (key: keyof PricingData) => (v: string) => onChange({ ...data, [key]: v });
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t("addNewItem.procurement")}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label={t("addNewItem.purchaseCostThb")} placeholder={t("addNewItem.purchaseCostPlaceholder")} value={data.purchaseCost} onChange={set("purchaseCost")} icon={Banknote} />
          <InputField label={t("addNewItem.purchaseDateLabel")} placeholder={t("addNewItem.purchaseDatePlaceholder")} type="date" value={data.purchaseDate} onChange={set("purchaseDate")} icon={Calendar} />
        </div>
      </SectionCard>
      <SectionCard title={t("addNewItem.rentalPricing")}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label={t("addNewItem.dailyRentalRateThb")} placeholder={t("addNewItem.dailyRentalRatePlaceholder")} value={data.dailyRate} onChange={set("dailyRate")} icon={Banknote} />
          <InputField label={t("addNewItem.weeklyRentalRateThb")} placeholder={t("addNewItem.weeklyRentalRatePlaceholder")} value={data.weeklyRate} onChange={set("weeklyRate")} icon={Banknote} />
          <InputField label={t("addNewItem.replacementValueThb")} placeholder={t("addNewItem.replacementValuePlaceholder")} value={data.replacementValue} onChange={set("replacementValue")} icon={Banknote} />
          <InputField label={t("addNewItem.securityDepositThb")} placeholder={t("addNewItem.securityDepositPlaceholder")} value={data.securityDeposit} onChange={set("securityDeposit")} icon={Banknote} />
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
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const SPEC_TEMPLATES = getSpecTemplates(t);
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
      <SectionCard title={t("addNewItem.dynamicAttributesTitle")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{t("addNewItem.selectSpecTemplate")}</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(SPEC_TEMPLATES).map(([key, tmpl]) => {
                const Icon = tmpl.icon;
                const active = data.template === key;
                return (
                  <button key={key} onClick={() => onChange({ ...data, template: key })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                      active ? "border-[#FFFF00]/50 bg-[#FFFF00]/10 text-[#FFFF00]" : "border-white/10 bg-white/[0.02] text-white/60 hover:border-white/20 hover:text-white"}`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{tmpl.label}</span>
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
                <InputField key={f.key} label={f.label} placeholder={tc("value")}
                  value={f.value} onChange={(v) => setCustomField(f.key, v)} />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input value={newCustomLabel} onChange={(e) => setNewCustomLabel(e.target.value)}
              placeholder={t("addNewItem.addCustomSpecPlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && addCustomField()}
              className="flex-1 h-8 bg-black/40 border border-dashed border-white/10 rounded-lg text-sm text-white px-3 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/30 transition-colors" />
            <button onClick={addCustomField}
              className="h-8 px-3 rounded-lg border border-dashed border-white/10 hover:border-[#FFFF00]/30 text-white/60 hover:text-[#FFFF00] text-xs flex items-center gap-1.5 transition-all">
              <Plus className="w-3 h-3" /> {t("addNewItem.addField")}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium">{t("addNewItem.protocolTags")}</label>
            <div className="flex flex-wrap gap-2">
              {allProtocolOptions.map((tag) => {
                const active = data.protocolTags.includes(tag);
                const isCustom = (data.customProtocolOptions ?? []).includes(tag);
                return (
                  <button key={tag} onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1 ${
                      active ? "border-[#FFFF00]/50 bg-[#FFFF00]/10 text-[#FFFF00]" : "border-white/10 text-white/60 hover:border-white/20 hover:text-white"}`}>
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
                placeholder={t("addNewItem.addCustomProtocolPlaceholder")}
                className="flex-1 h-8 bg-black/40 border border-dashed border-white/10 rounded-lg text-xs text-white px-3 placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/30 transition-colors"
              />
              <button onClick={addProtocolTag}
                className="h-8 px-3 rounded-lg border border-dashed border-white/10 hover:border-[#FFFF00]/30 text-white/60 hover:text-[#FFFF00] text-xs flex items-center gap-1.5 transition-all flex-shrink-0">
                <Plus className="w-3 h-3" /> {t("addNewItem.addTag")}
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={t("addNewItem.physicalAttributes")}>
        <div className="grid grid-cols-2 gap-4">
          <InputField label={t("addNewItem.weightKg")} placeholder={t("addNewItem.weightPlaceholder")} value={data.weight} onChange={(v) => onChange({ ...data, weight: v })} />
          <InputField label={t("addNewItem.dimensionsLabel")} placeholder={t("addNewItem.dimensionsPlaceholder")} value={data.dimensions} onChange={(v) => onChange({ ...data, dimensions: v })} />
        </div>
      </SectionCard>
    </div>
  );
};

// ─── Tab: Documents & Warranty ────────────────────────────────────────────────

interface DocsData {
  warrantyExpiry: string; supplierName: string; supportContact: string;
  manualUrl: string | null; certUrl: string | null; invoiceUrl: string | null;
}
const DocsTab = ({ data, onChange, companyId }: { data: DocsData; onChange: (d: DocsData) => void; companyId: string }) => {
  const { t } = useTranslation("modals");
  const set = (key: keyof DocsData) => (v: string) => onChange({ ...data, [key]: v });
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title={t("addNewItem.warrantySupport")}>
        <div className="grid grid-cols-3 gap-4">
          <InputField label={t("addNewItem.warrantyExpiryDate")} placeholder={t("addNewItem.purchaseDatePlaceholder")} type="date" value={data.warrantyExpiry} onChange={set("warrantyExpiry")} icon={Calendar} />
          <InputField label={t("addNewItem.supplierNameLabel")} placeholder={t("addNewItem.supplierNamePlaceholder")} value={data.supplierName} onChange={set("supplierName")} />
          <InputField label={t("addNewItem.supportContactLabel")} placeholder={t("addNewItem.supportContactPlaceholder")} value={data.supportContact} onChange={set("supportContact")} />
        </div>
      </SectionCard>

      <SectionCard title={t("addNewItem.documentsTitle")}>
        <div className="grid grid-cols-3 gap-4">
          <FileUploadField label={t("addNewItem.userManualPdf")} folder="stock-items" companyId={companyId}
            value={data.manualUrl} onChange={(url) => onChange({ ...data, manualUrl: url })} />
          <FileUploadField label={t("addNewItem.safetyCertificate")} folder="stock-items" companyId={companyId}
            value={data.certUrl} onChange={(url) => onChange({ ...data, certUrl: url })} />
          <FileUploadField label={t("addNewItem.purchaseInvoice")} folder="stock-items" companyId={companyId}
            value={data.invoiceUrl} onChange={(url) => onChange({ ...data, invoiceUrl: url })} />
        </div>
        <p className="text-[10px] text-white/60 mt-3">{t("addNewItem.acceptedFormatsHint")}</p>
      </SectionCard>
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

const TABS: { key: TabKey; icon: React.ElementType }[] = [
  { key: "general",   icon: Package },
  { key: "pricing",   icon: Banknote },
  { key: "specs",     icon: Cpu },
  { key: "documents", icon: FileText },
];

const TAB_LABEL_KEYS: Record<TabKey, string> = {
  general: "addNewItem.tabGeneral",
  pricing: "addNewItem.tabPricing",
  specs: "addNewItem.tabSpecs",
  documents: "addNewItem.tabDocuments",
};

interface AddNewItemModalProps {
  onClose:      () => void;
  onSubmit:     (data: Omit<InsertStockItem, "companyId">) => void;
  initialItem?: StockItem;
}

export const AddNewItemModal = ({ onClose, onSubmit, initialItem }: AddNewItemModalProps): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token, companyId } = useAppStore();
  const isEdit = !!initialItem;
  const [activeTab, setActiveTab] = useState<TabKey>("general");

  const { data: brands = [] } = useQuery({
    queryKey: ["catalog", "brands"], queryFn: catalogApi.getBrands, enabled: !!token,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["catalog", "categories"], queryFn: catalogApi.getCategories, enabled: !!token,
  });
  const { data: subCategories = [] } = useQuery({
    queryKey: ["catalog", "subcategories"], queryFn: catalogApi.getSubCategories, enabled: !!token,
  });

  const [general, setGeneral] = useState<GeneralData>(() => initGeneral(initialItem));
  const [pricing, setPricing] = useState<PricingData>(() => initPricing(initialItem));
  const [specs,   setSpecs]   = useState<SpecsData>(  () => initSpecs(initialItem));
  const [docs,    setDocs]    = useState<DocsData>(   () => initDocs(initialItem));

  const tabOrder: TabKey[] = ["general", "pricing", "specs", "documents"];
  const currentIdx = tabOrder.indexOf(activeTab);
  const canGoNext = currentIdx < tabOrder.length - 1;
  const canGoPrev = currentIdx > 0;

  const handleSave = () => {
    if (!general.itemName.trim()) return;
    const payload: Record<string, any> = {
      name:                general.itemName.trim(),
      brand:               general.brand,
      category:            general.category,
      subCategory:         general.subCategory,
      manufacturer:        general.manufacturer        || null,
      manufacturerCountry: general.manufacturerCountry || null,
      description:         general.description         || null,
      imageUrl:            general.imageUrl,
      purchaseCost:        pricing.purchaseCost        || null,
      purchaseDate:        pricing.purchaseDate        || null,  // string → server converts to Date
      dailyRate:           pricing.dailyRate           || null,
      weeklyRate:          pricing.weeklyRate          || null,
      replacementValue:    pricing.replacementValue    || null,
      securityDeposit:     pricing.securityDeposit     || null,
      weight:              specs.weight                || null,
      dimensions:          specs.dimensions            || null,
      specs: {
        template:              specs.template,
        fields:                specs.fields,
        customFields:          specs.customFields,
        protocolTags:          specs.protocolTags,
        customProtocolOptions: specs.customProtocolOptions,
      },
      warrantyExpiry: docs.warrantyExpiry || null,  // string → server converts to Date
      supplierName:   docs.supplierName   || null,
      supportContact: docs.supportContact || null,
      manualUrl:      docs.manualUrl,
      certUrl:        docs.certUrl,
      invoiceUrl:     docs.invoiceUrl,
    };
    payload.trackingMode = general.trackingMode;
    if (general.trackingMode === "bulk") {
      payload.quantity = parseInt(general.bulkQuantity, 10) || 0;
    } else if (!isEdit) {
      payload.quantity = 0;
    }

    onSubmit(payload as Omit<InsertStockItem, "companyId">);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFFF00" }}>
              {isEdit ? <Pencil className="w-4 h-4 text-black" /> : <Plus className="w-4 h-4 text-black" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isEdit ? t("addNewItem.editTitle", { name: initialItem!.name }) : t("addNewItem.addTitle")}
              </h2>
              <p className="text-[10px] text-white/60 capitalize">{t(TAB_LABEL_KEYS[activeTab])}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex items-center px-6 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto">
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const isDone = tabOrder.indexOf(tab.key) < currentIdx;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive ? "border-[#FFFF00] text-[#FFFF00]" : isDone ? "border-transparent text-white/60 hover:text-white" : "border-transparent text-white/60 hover:text-white"}`}>
                <Icon className="w-3.5 h-3.5" />
                {t(TAB_LABEL_KEYS[tab.key])}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "general"   && (
            <GeneralTab data={general} onChange={setGeneral} companyId={companyId ?? ""}
              brandOptions={brands.map((b) => b.name)}
              categoryOptions={categories.map((c) => c.name)}
              subCategoryOptions={subCategories.map((s) => s.name)} />
          )}
          {activeTab === "pricing"   && <PricingTab data={pricing} onChange={setPricing} />}
          {activeTab === "specs"     && <SpecsTab data={specs} onChange={setSpecs} />}
          {activeTab === "documents" && <DocsTab data={docs} onChange={setDocs} companyId={companyId ?? ""} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
          <button
            onClick={() => canGoPrev && setActiveTab(tabOrder[currentIdx - 1])}
            disabled={!canGoPrev}
            className="h-9 px-4 rounded-lg border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            {tc("back")}
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
              {tc("next")} <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="h-9 px-6 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#FFFF00" }}
            >
              {t("addNewItem.saveItem")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
