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

  // มือถือ: ชิปสูง 36px เลื่อนแนวนอนแถวเดียว (เดิม h-6=24px + flex-wrap ทำให้กดยากและกินหลายบรรทัด)
  const chip = (active: boolean) =>
    `h-9 md:h-6 px-3 md:px-2 rounded-full text-xs md:text-[10px] font-semibold transition-colors border flex-shrink-0 ${
      active ? "bg-brand text-black border-brand" : "text-fg/60 md:text-fg/50 border-fg/10 hover:border-fg/30"
    }`;

  return (
    <div className="h-scroll md:flex-wrap px-3 md:px-4 py-2 flex-shrink-0 flex gap-1.5 items-center border-b border-fg/[0.06]">
      <span className="text-[9px] uppercase tracking-wider text-fg/30 mr-0.5 flex-shrink-0">{t("manageJobStock.addingToZone")}</span>
      <button onClick={() => onActiveZoneChange("auto")} className={chip(activeZone === "auto")}>
        {t("manageJobStock.zoneAuto")}
      </button>
      {zones.map((z) => (
        <button key={z.id} onClick={() => onActiveZoneChange(z.name)} className={chip(activeZone === z.name)}>
          {z.name}
        </button>
      ))}
      <button onClick={() => onActiveZoneChange(null)} className={chip(activeZone === null)}>
        {t("manageJobStock.zoneNone")}
      </button>

      {!addingZone ? (
        <button
          onClick={() => setAddingZone(true)}
          className="h-9 w-9 md:h-6 md:w-6 rounded-full border border-fg/10 text-fg/50 hover:text-brand hover:border-brand/40 flex items-center justify-center transition-colors flex-shrink-0"
          aria-label={t("manageJobStock.addZone")}
          title={t("manageJobStock.addZone")}
        >
          <Plus className="w-4 h-4 md:w-3 md:h-3" aria-hidden="true" />
        </button>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
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
            className="h-9 md:h-6 w-32 md:w-24 px-3 md:px-2 rounded-full bg-fg/[0.06] border border-fg/10 text-xs md:text-[10px] text-fg outline-none focus:border-brand/40"
          />
          <button
            onClick={() => { setNewZoneName(""); setAddingZone(false); }}
            aria-label="ยกเลิก"
            className="tap-target text-fg/40 hover:text-fg transition-colors p-1"
          >
            <XIcon className="w-4 h-4 md:w-3 md:h-3" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
