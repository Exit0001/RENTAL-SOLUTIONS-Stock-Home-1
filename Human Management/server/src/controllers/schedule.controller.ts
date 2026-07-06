import type { Request, Response } from "express";
import { z } from "zod";
import { getSchedule } from "../services/schedule.service";

const querySchema = z.object({
  from: z.string(),
  to: z.string(),
});

export async function getScheduleHandler(req: Request, res: Response) {
  const { from, to } = querySchema.parse(req.query);
  const resources = await getSchedule(from, to);
  res.json(resources);
}
