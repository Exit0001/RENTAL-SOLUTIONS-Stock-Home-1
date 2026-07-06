import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { vehicles } from "../db/schema";

export const vehicleSelectSchema = createSelectSchema(vehicles);

export const vehicleInsertSchema = createInsertSchema(vehicles, {
  plateNumber: z.string().min(1, "กรุณากรอกทะเบียนรถ"),
  vehicleType: z.string().min(1, "กรุณากรอกประเภทรถ"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const vehicleUpdateSchema = vehicleInsertSchema.partial();

export type Vehicle = z.infer<typeof vehicleSelectSchema>;
export type VehicleInsert = z.infer<typeof vehicleInsertSchema>;
export type VehicleUpdate = z.infer<typeof vehicleUpdateSchema>;
