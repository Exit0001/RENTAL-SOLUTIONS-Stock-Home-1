import type { Request, Response } from "express";
import * as dashboardService from "../services/dashboard.service";

export async function getSummary(_req: Request, res: Response) {
  const summary = await dashboardService.getDashboardSummary();
  res.json(summary);
}

export async function getUpcomingJobs(req: Request, res: Response) {
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
  const rows = await dashboardService.getUpcomingJobs(limit);
  res.json(rows);
}
