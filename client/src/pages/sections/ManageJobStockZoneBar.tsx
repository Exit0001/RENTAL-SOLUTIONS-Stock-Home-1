import React, { useState } from "react";
import { Plus, X as XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Position } from "@shared/schema";

interface Props {
  zones:              Position[];
  activeZone:         string | null;
  onActiveZoneChange: (v: string | null) => void;
  onCreateZone:       (name: string) => void;
  creatingZone:       boolean;
}

// เพิ่มเข้าโซน: chip row — เลือกโซนที่ของใหม่ (อุปกรณ์เดี่ยว/แร็ค/ชุด) จะถูก tag ให้ทันที
// ยกออกมาจาก ManageJobStockCatalogPane เดิม เพื่อให้ใช้ร่วมกันได้ทั้ง 3 โหมด (อุปกรณ์/แร็ค/ชุด)
export const ManageJobStockZoneBar = ({
  zones, activeZone, onActiveZoneChange, onCreateZone, creatingZone,
}: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const [addingZone,  setAddingZone]  = useState(false);
  const [newZoneName, setNewZoneName] = useState("");

  return (
    <div className="px-4 py-2 flex-shrink-0 flex flex-wrap gap-1.5 items-center border-b border-white/[0.06]">
      <span className="text-[9px] uppercase tracking-wider text-white/30 mr-0.5">{t("manageJobStock.addingToZone")}</span>
      <button
        onClick={() => onActiveZoneChange("auto")}
        className={`h-6 px-2 rounded-full text-[10px] font-semibold transition-colors border
          ${activeZone === "auto" ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/50 border-white/10 hover:border-white/30"}`}
      >
        {t("manageJobStock.zoneAuto")}
      </button>
      {zones.map((z) => (
        <button
          key={z.id}
          onClick={() => onActiveZoneChange(z.name)}
          className={`h-6 px-2 rounded-full text-[10px] font-semibold transition-colors border
            ${activeZone === z.name ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/50 border-white/10 hover:border-white/30"}`}
        >
          {z.name}
        </button>
      ))}
      <button
        onClick={() => onActiveZoneChange(null)}
        className={`h-6 px-2 rounded-full text-[10px] font-semibold transition-colors border
          ${activeZone === null ? "bg-[#FFFF00] text-black border-[#FFFF00]" : "text-white/50 border-white/10 hover:border-white/30"}`}
      >
        {t("manageJobStock.zoneNone")}
      </button>

      {!addingZone ? (
        <button
          onClick={() => setAddingZone(true)}
          className="h-6 w-6 rounded-full border border-white/10 text-white/40 hover:text-[#FFFF00] hover:border-[#FFFF00]/40 flex items-center justify-center transition-colors"
          title={t("manageJobStock.addZone")}
        >
          <Plus className="w-3 h-3" />
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onCreateZone(newZoneName); setNewZoneName(""); setAddingZone(false); }
              if (e.key === "Escape") { setNewZoneName(""); setAddingZone(false); }
            }}
            placeholder={t("manageJobStock.newZonePlaceholder")}
            disabled={creatingZone}
            className="h-6 w-24 px-2 rounded-full bg-white/[0.06] border border-white/10 text-[10px] text-white outline-none focus:border-[#FFFF00]/40"
          />
          <button
            onClick={() => { setNewZoneName(""); setAddingZone(false); }}
            className="text-white/40 hover:text-white transition-colors"
          >
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
