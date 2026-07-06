import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Staff } from "@app/shared/validation/staff.schema";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { AVAILABILITY_STATUS_LABELS } from "@/lib/labels";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  available: "default",
  unavailable: "secondary",
  on_leave: "destructive",
};

interface StaffTableProps {
  staff: Staff[];
  onEdit: (staff: Staff) => void;
  onDelete: (staff: Staff) => void;
}

export function StaffTable({ staff, onEdit, onDelete }: StaffTableProps) {
  if (staff.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีพนักงาน</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ชื่อ</TableHead>
          <TableHead>ตำแหน่ง</TableHead>
          <TableHead>เบอร์โทร</TableHead>
          <TableHead>สถานะ</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {staff.map((member) => (
          <TableRow key={member.id}>
            <TableCell className="font-medium">{member.name}</TableCell>
            <TableCell>{member.role}</TableCell>
            <TableCell>{member.phone || "-"}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[member.status]}>{AVAILABILITY_STATUS_LABELS[member.status]}</Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(member)}>
                    <Pencil className="mr-2 h-4 w-4" /> แก้ไข
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(member)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> ลบ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
