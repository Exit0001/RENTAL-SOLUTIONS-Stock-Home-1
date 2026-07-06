import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { Staff } from "@app/shared/validation/staff.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useStaffList, useDeleteStaff } from "@/hooks/useStaff";
import { StaffTable } from "./StaffTable";
import { StaffFormDialog } from "./StaffFormDialog";
import { StaffBulkAddDialog } from "./StaffBulkAddDialog";

export function StaffListView() {
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | undefined>(undefined);

  const { data: staff, isLoading } = useStaffList(search || undefined);
  const deleteStaff = useDeleteStaff();

  function handleEdit(member: Staff) {
    setEditingStaff(member);
  }

  async function handleDelete(member: Staff) {
    if (!confirm(`ลบพนักงาน ${member.name} หรือไม่?`)) return;
    try {
      await deleteStaff.mutateAsync(member.id);
      toast.success("ลบพนักงานแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ลบพนักงานไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">พนักงาน</h2>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> เพิ่มพนักงาน
        </Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="ค้นหาชื่อหรือตำแหน่ง..."
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
        <StaffTable staff={staff ?? []} onEdit={handleEdit} onDelete={handleDelete} />
      )}
      <StaffBulkAddDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      {editingStaff && (
        <StaffFormDialog
          open={!!editingStaff}
          onOpenChange={(open) => !open && setEditingStaff(undefined)}
          staff={editingStaff}
        />
      )}
    </div>
  );
}
