import { useState } from "react";
import { X, Layers, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/store/appStore";
import { catalogApi } from "@/api";
import type { ContainerType } from "@shared/schema";

interface Props { onClose: () => void; }

export const ManageContainerTypesModal = ({ onClose }: Props): JSX.Element => {
  const { t } = useTranslation("modals");
  const { t: tc } = useTranslation("common");
  const { token } = useAppStore();
  const qc = useQueryClient();
  const [newType, setNewType] = useState("");

  const { data: containerTypes = [] } = useQuery({
    queryKey: ["catalog", "container-types"],
    queryFn: catalogApi.getContainerTypes,
    enabled: !!token,
  });

  const createContainerType = useMutation({
    mutationFn: catalogApi.createContainerType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "container-types"] }),
  });
  const deleteContainerType = useMutation({
    mutationFn: catalogApi.deleteContainerType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "container-types"] }),
  });

  const addType = () => {
    const trimmed = newType.trim();
    if (trimmed && !containerTypes.some((t) => t.name === trimmed)) {
      createContainerType.mutate({ name: trimmed });
    }
    setNewType("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#0f0f0f] border border-white/[0.08] rounded-2xl shadow-2xl animate-modal-up flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FFFF00" }}>
              <Layers className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{t("manageContainerTypes.title")}</h2>
              <p className="text-[10px] text-white/60">{t("manageContainerTypes.subtitle")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add new type input */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <label className="text-[10px] text-white/60 uppercase tracking-wider font-medium block mb-2">
            {t("manageContainerTypes.newContainerType")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addType()}
              placeholder={t("manageContainerTypes.newTypePlaceholder")}
              className="flex-1 h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3
                placeholder:text-white/60 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
            />
            <button
              onClick={addType}
              disabled={!newType.trim()}
              className="h-9 px-4 rounded-lg text-sm font-bold text-black flex items-center gap-1.5 transition-opacity hover:opacity-80 disabled:opacity-30 disabled:pointer-events-none"
              style={{ backgroundColor: "#FFFF00" }}
            >
              <Plus className="w-3.5 h-3.5" />
              {tc("add")}
            </button>
          </div>
        </div>

        {/* Container types list */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
          {containerTypes.map((t: ContainerType) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                <span className="text-sm text-white/70">{t.name}</span>
              </div>
              <button
                onClick={() => deleteContainerType.mutate(t.id)}
                className="w-6 h-6 flex items-center justify-center rounded text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-6 rounded-lg text-sm font-bold text-black transition-opacity hover:opacity-80"
            style={{ backgroundColor: "#FFFF00" }}
          >
            {tc("done")}
          </button>
        </div>
      </div>
    </div>
  );
};
