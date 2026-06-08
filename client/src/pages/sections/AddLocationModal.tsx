import { useState } from "react";
import { X, MapPin, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/appStore";
import { catalogApi } from "@/api";
import type { Location } from "@shared/schema";

interface Props { onClose: () => void; }

export const AddLocationModal = ({ onClose }: Props): JSX.Element => {
  const { token } = useAppStore();
  const qc = useQueryClient();
  const [newLocation, setNewLocation] = useState("");

  const { data: locations = [] } = useQuery({
    queryKey: ["catalog", "locations"],
    queryFn: catalogApi.getLocations,
    enabled: !!token,
  });

  const createLocation = useMutation({
    mutationFn: catalogApi.createLocation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "locations"] }),
  });
  const deleteLocation = useMutation({
    mutationFn: catalogApi.deleteLocation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "locations"] }),
  });

  const addLocation = () => {
    const trimmed = newLocation.trim();
    if (trimmed && !locations.some((l) => l.name === trimmed)) {
      createLocation.mutate({ name: trimmed, isDefault: false });
    }
    setNewLocation("");
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
              <MapPin className="w-4 h-4 text-black" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Manage Locations</h2>
              <p className="text-[10px] text-white/30">Add or remove storage locations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add new location input */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <label className="text-[10px] text-white/35 uppercase tracking-wider font-medium block mb-2">
            New Location
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addLocation()}
              placeholder="e.g. Warehouse C, Zone 1…"
              className="flex-1 h-9 bg-black/40 border border-white/10 rounded-lg text-sm text-white px-3
                placeholder:text-white/20 focus:outline-none focus:border-[#FFFF00]/40 transition-colors"
            />
            <button
              onClick={addLocation}
              disabled={!newLocation.trim()}
              className="h-9 px-4 rounded-lg text-sm font-bold text-black flex items-center gap-1.5 transition-opacity hover:opacity-80 disabled:opacity-30 disabled:pointer-events-none"
              style={{ backgroundColor: "#FFFF00" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </div>

        {/* Locations list */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1">
          {locations.map((loc: Location) => (
            <div
              key={loc.id}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                <span className="text-sm text-white/70">{loc.name}</span>
                {loc.isDefault && (
                  <span className="text-[9px] text-white/20 uppercase tracking-wider border border-white/10 px-1.5 py-0.5 rounded">
                    default
                  </span>
                )}
              </div>
              {!loc.isDefault && (
                <button
                  onClick={() => deleteLocation.mutate(loc.id)}
                  className="w-6 h-6 flex items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
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
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
