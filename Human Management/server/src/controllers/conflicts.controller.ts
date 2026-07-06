import type { Request, Response } from "express";
import { conflictsByDateSchema } from "@app/shared/validation/assignments.schema";
import { getConflictsByDate } from "../services/conflicts.service";

export async function getConflictsByDateHandler(req: Request, res: Response) {
  const input = conflictsByDateSchema.parse(req.body);
  const result = await getConflictsByDate(input);
  res.json(result);
}
