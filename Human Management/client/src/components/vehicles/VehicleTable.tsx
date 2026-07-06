import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Vehicle } from "@app/shared/validation/vehicles.schema";
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

interface VehicleTableProps {
  vehicles: Vehicle[];
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (vehicle: Vehicle) => void;
}

export function VehicleTable({ vehicles, onEdit, onDelete }: VehicleTableProps) {
  if (vehicles.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีรถ</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ทะเบียน</TableHead>
          <TableHead>ประเภท</TableHead>
          <TableHead>สถานะ</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {vehicles.map((vehicle) => (
          <TableRow key={vehicle.id}>
            <TableCell className="font-medium">{vehicle.plateNumber}</TableCell>
            <TableCell>{vehicle.vehicleType}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[vehicle.status]}>{AVAILABILITY_STATUS_LABELS[vehicle.status]}</Badge>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(vehicle)}>
                    <Pencil className="mr-2 h-4 w-4" /> แก้ไข
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(vehicle)} className="text-destructive">
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
