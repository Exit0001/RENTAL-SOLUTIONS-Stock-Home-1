import type { Request, Response } from "express";
import { staffInsertSchema, staffUpdateSchema, staffBulkInsertSchema } from "@app/shared/validation/staff.schema";
import * as staffService from "../services/staff.service";
import { param } from "../lib/params";

export async function listStaff(req: Request, res: Response) {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const rows = await staffService.listStaff(search);
  res.json(rows);
}

export async function getStaff(req: Request, res: Response) {
  const row = await staffService.getStaffById(param(req, "id"));
  if (!row) {
    res.status(404).json({ error: "ไม่พบพนักงานคนนี้" });
    return;
  }
  res.json(row);
}

export async function createStaff(req: Request, res: Response) {
  const input = staffInsertSchema.parse(req.body);
  const row = await staffService.createStaff(input);
  res.status(201).json(row);
}

export async function createManyStaff(req: Request, res: Response) {
  const { staff: inputs } = staffBulkInsertSchema.parse(req.body);
  const rows = await staffService.createManyStaff(inputs);
  res.status(201).json(rows);
}

export async function updateStaff(req: Request, res: Response) {
  const input = staffUpdateSchema.parse(req.body);
  const row = await staffService.updateStaff(param(req, "id"), input);
  if (!row) {
    res.status(404).json({ error: "ไม่พบพนักงานคนนี้" });
    return;
  }
  res.json(row);
}

export async function deleteStaff(req: Request, res: Response) {
  await staffService.deleteStaff(param(req, "id"));
  res.status(204).send();
}
