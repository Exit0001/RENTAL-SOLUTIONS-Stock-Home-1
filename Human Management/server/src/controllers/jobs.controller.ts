import type { Request, Response } from "express";
import { jobWithAssignmentsSchema, jobWithAssignmentsUpdateSchema } from "@app/shared/validation/jobs.schema";
import * as jobsService from "../services/jobs.service";
import { param } from "../lib/params";

export async function listJobs(req: Request, res: Response) {
  const { from, to, status, search } = req.query;
  const rows = await jobsService.listJobs({
    from: typeof from === "string" ? from : undefined,
    to: typeof to === "string" ? to : undefined,
    status: typeof status === "string" ? status : undefined,
    search: typeof search === "string" ? search : undefined,
  });
  res.json(rows);
}

export async function getJob(req: Request, res: Response) {
  const job = await jobsService.getJobWithAssignments(param(req, "id"));
  if (!job) {
    res.status(404).json({ error: "ไม่พบงานนี้" });
    return;
  }
  res.json(job);
}

export async function createJob(req: Request, res: Response) {
  const input = jobWithAssignmentsSchema.parse(req.body);
  const job = await jobsService.createJobWithAssignments(input);
  res.status(201).json(job);
}

export async function updateJob(req: Request, res: Response) {
  const input = jobWithAssignmentsUpdateSchema.parse(req.body);
  const job = await jobsService.updateJobWithAssignments(param(req, "id"), input);
  if (!job) {
    res.status(404).json({ error: "ไม่พบงานนี้" });
    return;
  }
  res.json(job);
}

export async function deleteJob(req: Request, res: Response) {
  await jobsService.deleteJob(param(req, "id"));
  res.status(204).send();
}
