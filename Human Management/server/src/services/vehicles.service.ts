import { eq, like, or } from "drizzle-orm";
import { db } from "../db/client";
import { vehicles } from "@app/shared/db/schema";
import type { VehicleInsert, VehicleUpdate } from "@app/shared/validation/vehicles.schema";

export async function listVehicles(search?: string) {
  if (search) {
    return db
      .select()
      .from(vehicles)
      .where(or(like(vehicles.plateNumber, `%${search}%`), like(vehicles.vehicleType, `%${search}%`)));
  }
  return db.select().from(vehicles);
}

export async function getVehicleById(id: string) {
  const rows = await db.select().from(vehicles).where(eq(vehicles.id, id));
  return rows[0];
}

export async function createVehicle(input: VehicleInsert) {
  const rows = await db.insert(vehicles).values(input).returning();
  return rows[0];
}

export async function updateVehicle(id: string, input: VehicleUpdate) {
  const rows = await db.update(vehicles).set(input).where(eq(vehicles.id, id)).returning();
  return rows[0];
}

export async function deleteVehicle(id: string) {
  await db.delete(vehicles).where(eq(vehicles.id, id));
}
