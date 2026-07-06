import { eq, like, or } from "drizzle-orm";
import { db } from "../db/client";
import { staff } from "@app/shared/db/schema";
import type { StaffInsert, StaffUpdate } from "@app/shared/validation/staff.schema";

export async function listStaff(search?: string) {
  if (search) {
    return db
      .select()
      .from(staff)
      .where(or(like(staff.name, `%${search}%`), like(staff.role, `%${search}%`)));
  }
  return db.select().from(staff);
}

export async function getStaffById(id: string) {
  const rows = await db.select().from(staff).where(eq(staff.id, id));
  return rows[0];
}

export async function createStaff(input: StaffInsert) {
  const rows = await db.insert(staff).values(input).returning();
  return rows[0];
}

export async function createManyStaff(inputs: StaffInsert[]) {
  return db.insert(staff).values(inputs).returning();
}

export async function updateStaff(id: string, input: StaffUpdate) {
  const rows = await db.update(staff).set(input).where(eq(staff.id, id)).returning();
  return rows[0];
}

export async function deleteStaff(id: string) {
  await db.delete(staff).where(eq(staff.id, id));
}
