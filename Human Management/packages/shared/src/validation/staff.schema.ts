import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { staff } from "../db/schema";

export const staffSelectSchema = createSelectSchema(staff);

export const staffInsertSchema = createInsertSchema(staff, {
  name: z.string().min(1, "กรุณากรอกชื่อ"),
  role: z.string().min(1, "กรุณากรอกตำแหน่ง"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const staffUpdateSchema = staffInsertSchema.partial();

export const staffBulkInsertSchema = z.object({
  staff: z.array(staffInsertSchema).min(1, "กรุณาเพิ่มพนักงานอย่างน้อย 1 คน"),
});

export type Staff = z.infer<typeof staffSelectSchema>;
export type StaffInsert = z.infer<typeof staffInsertSchema>;
export type StaffUpdate = z.infer<typeof staffUpdateSchema>;
export type StaffBulkInsert = z.infer<typeof staffBulkInsertSchema>;
