import type { Request, Response } from "express";
import { vehicleInsertSchema, vehicleUpdateSchema } from "@app/shared/validation/vehicles.schema";
import * as vehiclesService from "../services/vehicles.service";
import { param } from "../lib/params";

export async function listVehicles(req: Request, res: Response) {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const rows = await vehiclesService.listVehicles(search);
  res.json(rows);
}

export async function getVehicle(req: Request, res: Response) {
  const row = await vehiclesService.getVehicleById(param(req, "id"));
  if (!row) {
    res.status(404).json({ error: "ไม่พบรถคันนี้" });
    return;
  }
  res.json(row);
}

export async function createVehicle(req: Request, res: Response) {
  const input = vehicleInsertSchema.parse(req.body);
  const row = await vehiclesService.createVehicle(input);
  res.status(201).json(row);
}

export async function updateVehicle(req: Request, res: Response) {
  const input = vehicleUpdateSchema.parse(req.body);
  const row = await vehiclesService.updateVehicle(param(req, "id"), input);
  if (!row) {
    res.status(404).json({ error: "ไม่พบรถคันนี้" });
    return;
  }
  res.json(row);
}

export async function deleteVehicle(req: Request, res: Response) {
  await vehiclesService.deleteVehicle(param(req, "id"));
  res.status(204).send();
}
