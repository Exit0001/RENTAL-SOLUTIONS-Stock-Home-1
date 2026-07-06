import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { Vehicle } from "@app/shared/validation/vehicles.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useVehicleList, useDeleteVehicle } from "@/hooks/useVehicles";
import { VehicleTable } from "./VehicleTable";
import { VehicleFormDialog } from "./VehicleFormDialog";

export function VehicleListView() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | undefined>(undefined);

  const { data: vehicles, isLoading } = useVehicleList(search || undefined);
  const deleteVehicle = useDeleteVehicle();

  function handleAdd() {
    setEditingVehicle(undefined);
    setDialogOpen(true);
  }

  function handleEdit(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setDialogOpen(true);
  }

  async function handleDelete(vehicle: Vehicle) {
    if (!confirm(`ลบรถทะเบียน ${vehicle.plateNumber} หรือไม่?`)) return;
    try {
      await deleteVehicle.mutateAsync(vehicle.id);
      toast.success("ลบรถแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบรถไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">รถ</h2>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" /> เพิ่มรถ
        </Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาทะเบียนหรือประเภทรถ..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <VehicleTable vehicles={vehicles ?? []} onEdit={handleEdit} onDelete={handleDelete} />
      )}
      <VehicleFormDialog open={dialogOpen} onOpenChange={setDialogOpen} vehicle={editingVehicle} />
    </div>
  );
}
