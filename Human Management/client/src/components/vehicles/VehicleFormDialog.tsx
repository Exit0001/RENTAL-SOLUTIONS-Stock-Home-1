import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { vehicleInsertSchema, type Vehicle, type VehicleInsert } from "@app/shared/validation/vehicles.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateVehicle, useUpdateVehicle } from "@/hooks/useVehicles";

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: Vehicle;
}

const defaultValues: VehicleInsert = {
  plateNumber: "",
  vehicleType: "",
  status: "available",
  notes: "",
};

export function VehicleFormDialog({ open, onOpenChange, vehicle }: VehicleFormDialogProps) {
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const isEditing = !!vehicle;

  const form = useForm<VehicleInsert>({
    resolver: zodResolver(vehicleInsertSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        vehicle
          ? {
              plateNumber: vehicle.plateNumber,
              vehicleType: vehicle.vehicleType,
              status: vehicle.status,
              notes: vehicle.notes ?? "",
            }
          : defaultValues,
      );
    }
  }, [open, vehicle, form]);

  async function onSubmit(values: VehicleInsert) {
    try {
      if (isEditing) {
        await updateVehicle.mutateAsync({ id: vehicle.id, input: values });
        toast.success("บันทึกข้อมูลรถแล้ว");
      } else {
        await createVehicle.mutateAsync(values);
        toast.success("เพิ่มรถแล้ว");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "แก้ไขข้อมูลรถ" : "เพิ่มรถ"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="plateNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ทะเบียนรถ</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="เช่น 1กก-1234" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ประเภทรถ</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="เช่น รถบรรทุก, รถตู้, กระบะ" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สถานะ</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="available">ว่าง</SelectItem>
                      <SelectItem value="unavailable">ไม่ว่าง</SelectItem>
                      <SelectItem value="on_leave">ซ่อมบำรุง</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>หมายเหตุ</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {isEditing ? "บันทึกการแก้ไข" : "เพิ่มรถ"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
