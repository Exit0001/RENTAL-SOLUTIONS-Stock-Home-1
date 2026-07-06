import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { StaffInsert } from "@app/shared/validation/staff.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateManyStaff } from "@/hooks/useStaff";
import { cn } from "@/lib/utils";

interface StaffBulkAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DraftRow {
  name: string;
  role: string;
  phone: string;
  status: "available" | "unavailable" | "on_leave";
}

function emptyRow(): DraftRow {
  return { name: "", role: "", phone: "", status: "available" };
}

function makeInitialRows(): DraftRow[] {
  return [emptyRow(), emptyRow(), emptyRow()];
}

export function StaffBulkAddDialog({ open, onOpenChange }: StaffBulkAddDialogProps) {
  const [rows, setRows] = useState<DraftRow[]>(makeInitialRows);
  const [invalidIndexes, setInvalidIndexes] = useState<Set<number>>(new Set());
  const createManyStaff = useCreateManyStaff();

  function handleOpenChange(next: boolean) {
    if (next) {
      setRows(makeInitialRows());
      setInvalidIndexes(new Set());
    }
    onOpenChange(next);
  }

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function isRowTouched(row: DraftRow) {
    return row.name.trim() !== "" || row.role.trim() !== "" || row.phone.trim() !== "";
  }

  async function handleSubmit() {
    const invalid = new Set<number>();
    const validRows: StaffInsert[] = [];

    rows.forEach((row, index) => {
      if (!isRowTouched(row)) return;
      if (!row.name.trim() || !row.role.trim()) {
        invalid.add(index);
        return;
      }
      validRows.push({
        name: row.name.trim(),
        role: row.role.trim(),
        phone: row.phone.trim() || null,
        status: row.status,
        notes: null,
      });
    });

    if (invalid.size > 0) {
      setInvalidIndexes(invalid);
      toast.error("กรุณากรอกชื่อและตำแหน่งให้ครบในทุกแถวที่กรอกข้อมูล");
      return;
    }

    if (validRows.length === 0) {
      toast.error("กรุณากรอกข้อมูลพนักงานอย่างน้อย 1 คน");
      return;
    }

    try {
      await createManyStaff.mutateAsync(validRows);
      toast.success(`เพิ่มพนักงาน ${validRows.length} คนแล้ว`);
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>เพิ่มพนักงานหลายคน</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1fr_140px_140px_36px] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
            <span>ชื่อ</span>
            <span>ตำแหน่ง</span>
            <span>เบอร์โทร</span>
            <span>สถานะ</span>
            <span />
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_140px_140px_36px]">
                <div className="space-y-1">
                  <Label className="sm:hidden">ชื่อ</Label>
                  <Input
                    value={row.name}
                    onChange={(e) => updateRow(index, { name: e.target.value })}
                    placeholder="ชื่อ"
                    className={cn(invalidIndexes.has(index) && !row.name.trim() && "border-destructive")}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="sm:hidden">ตำแหน่ง</Label>
                  <Input
                    value={row.role}
                    onChange={(e) => updateRow(index, { role: e.target.value })}
                    placeholder="ตำแหน่ง"
                    className={cn(invalidIndexes.has(index) && !row.role.trim() && "border-destructive")}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="sm:hidden">เบอร์โทร</Label>
                  <Input
                    value={row.phone}
                    onChange={(e) => updateRow(index, { phone: e.target.value })}
                    placeholder="08x-xxx-xxxx"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="sm:hidden">สถานะ</Label>
                  <Select
                    value={row.status}
                    onValueChange={(value) => updateRow(index, { status: value as DraftRow["status"] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">ว่าง</SelectItem>
                      <SelectItem value="unavailable">ไม่ว่าง</SelectItem>
                      <SelectItem value="on_leave">ลา</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-end sm:justify-center sm:pb-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(index)}
                    disabled={rows.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" /> เพิ่มแถว
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleSubmit} disabled={createManyStaff.isPending}>
            บันทึกพนักงานทั้งหมด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
